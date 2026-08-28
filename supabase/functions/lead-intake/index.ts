import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_BODY_BYTES = 16_384;
const RATE_WINDOW_MINUTES = 10;
const MAX_FORM_SUBMISSIONS = 120;
const MAX_IP_SUBMISSIONS = 20;
const MAX_PHONE_SUBMISSIONS = 3;
const EDGE_HEADERS = "authorization, x-client-info, apikey, content-type";
const EDGE_METHODS = "POST, OPTIONS";

type IntakeBody = Record<string, unknown>;

const TEXT_FIELD_LIMITS = Object.freeze({
  clinic_slug: 120,
  landing_token: 160,
  nombre: 120,
  telefono: 32,
  tratamiento: 120,
  urgencia: 80,
  evaluacion_previa: 120,
  situacion: 160,
  consultation_reason: 300,
  motivo_consulta: 300,
  origen: 120,
  source: 120,
  pagina: 120,
  page: 120,
  notes: 1000,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 240,
  utm_content: 240,
  utm_term: 240,
  landing_page: 500,
  referrer: 500,
  website: 120,
  company: 120,
  form_started_at: 64,
});

const FORBIDDEN_ROUTING_FIELDS = Object.freeze([
  "clinic_id",
  "lead_id",
  "appointment_id",
  "appointment",
  "quote_id",
  "quote",
  "assigned_to",
]);

type PhoneResult =
  | { ok: true; phone: string; phonePlus: string }
  | { ok: false };

function corsHeaders(origin: string | null) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": EDGE_HEADERS,
    "Access-Control-Allow-Methods": EDGE_METHODS,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(origin: string | null, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function sanitizeText(value: unknown, maxLength: number, fallback = "") {
  const raw = typeof value === "string" ? value : "";
  const clean = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return clean || fallback;
}

function isPlainIntakeBody(value: unknown): value is IntakeBody {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasValidFieldShapes(body: IntakeBody) {
  for (const [field, maxLength] of Object.entries(TEXT_FIELD_LIMITS)) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.length > maxLength) return false;
  }

  for (const field of FORBIDDEN_ROUTING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) return false;
  }

  return true;
}

function isImplausiblyFastSubmission(body: IntakeBody) {
  if (body.form_started_at === undefined || body.form_started_at === null) return false;
  const startedAt = Date.parse(String(body.form_started_at));
  if (!Number.isFinite(startedAt)) return true;
  const elapsed = Date.now() - startedAt;
  return elapsed < 800;
}

function normalizeClinicSlug(value: unknown) {
  return sanitizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeParaguayPhone(value: unknown): PhoneResult {
  const digits = sanitizeText(value, 32).replace(/\D/g, "");
  let local = "";

  if (digits.startsWith("595") && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 10) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  }

  if (!/^9\d{8}$/.test(local)) {
    return { ok: false };
  }

  const phone = `595${local}`;
  return { ok: true, phone, phonePlus: `+${phone}` };
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashWithSalt(salt: string, value: string | null) {
  if (!value) return null;
  return await sha256Hex(`${salt}:${value}`);
}

function getClientIp(req: Request) {
  const platformIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
  if (platformIp) return platformIp.trim() || null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return null;
}

function isHoneypotFilled(body: IntakeBody) {
  return Boolean(sanitizeText(body.website, 120) || sanitizeText(body.company, 120));
}

function dbErrorCode(error: unknown) {
  if (!error) return "unknown";
  if (typeof error === "object" && "code" in error) {
    return sanitizeText((error as { code?: unknown }).code, 40, "unknown");
  }
  return "unknown";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hashSalt = Deno.env.get("FORM_HASH_SALT");

  if (!supabaseUrl || !serviceRoleKey || !hashSalt) {
    return jsonResponse(null, 500, {
      success: false,
      message: "Error interno",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let responseOrigin: string | null = null;
  if (origin) {
    const { data: originConfig, error: originError } = await supabase
      .from("clinic_public_forms")
      .select("id")
      .eq("is_active", true)
      .contains("allowed_origins", [origin])
      .limit(1)
      .maybeSingle();

    if (originError) {
      console.error("lead-intake origin lookup failed", dbErrorCode(originError));
      return jsonResponse(null, 500, {
        success: false,
        message: "Error interno",
      });
    }

    if (originConfig) responseOrigin = origin;
  }

  if (req.method === "OPTIONS") {
    if (!responseOrigin) {
      return jsonResponse(null, 403, {
        success: false,
        message: "Origin no permitido",
      });
    }

    return new Response(null, { status: 200, headers: corsHeaders(responseOrigin) });
  }

  if (req.method !== "POST") {
    return jsonResponse(responseOrigin, 405, {
      success: false,
      message: "Metodo no permitido",
    });
  }

  if (!origin) {
    return jsonResponse(null, 403, {
      success: false,
      message: "Origin requerido",
    });
  }

  if (!responseOrigin) {
    return jsonResponse(null, 403, {
      success: false,
      message: "Origin no permitido",
    });
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Payload invalido",
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonResponse(responseOrigin, 415, {
        success: false,
        message: "Payload invalido",
      });
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Payload invalido",
      });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody || "{}");
    } catch {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "JSON invalido",
      });
    }

    if (!isPlainIntakeBody(parsedBody) || !hasValidFieldShapes(parsedBody)) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Payload invalido",
      });
    }

    const body = parsedBody;

    const clinicSlug = normalizeClinicSlug(body.clinic_slug);
    const landingToken = sanitizeText(body.landing_token, 160);

    if (!clinicSlug || !landingToken) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Datos incompletos",
      });
    }

    const { data: publicForm, error: formError } = await supabase
      .from("clinic_public_forms")
      .select("id, clinic_id, clinic_slug, public_token, allowed_origins, is_active")
      .eq("clinic_slug", clinicSlug)
      .eq("public_token", landingToken)
      .eq("is_active", true)
      .maybeSingle();

    if (formError) throw formError;

    if (!publicForm) {
      return jsonResponse(responseOrigin, 403, {
        success: false,
        message: "Formulario no autorizado",
      });
    }

    const formConfig = publicForm;

    const allowedOrigins = Array.isArray(formConfig.allowed_origins)
      ? formConfig.allowed_origins.filter(Boolean)
      : [];

    const clientIp = getClientIp(req) || "missing-client-ip";
    const ipHash = await hashWithSalt(hashSalt, clientIp);
    let phoneHash: string | null = null;

    if (origin && !allowedOrigins.includes(origin)) {
      return jsonResponse(null, 403, {
        success: false,
        message: "Origin no permitido",
      });
    }

    if (isHoneypotFilled(body)) {
      return jsonResponse(responseOrigin, 403, {
        success: false,
        message: "Formulario no autorizado",
      });
    }

    if (isImplausiblyFastSubmission(body)) {
      return jsonResponse(responseOrigin, 403, {
        success: false,
        message: "Formulario no autorizado",
      });
    }

    const consentContact = body.consentimiento_contacto === true || body.consent_contact === true;
    if (!consentContact) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Debés aceptar el consentimiento de contacto",
      });
    }

    const phoneResult = normalizeParaguayPhone(body.telefono);
    if (!phoneResult.ok) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Tel\u00e9fono inv\u00e1lido",
      });
    }

    phoneHash = await hashWithSalt(hashSalt, phoneResult.phonePlus);

    const name = sanitizeText(body.nombre, 120);
    if (name.length < 2) {
      return jsonResponse(responseOrigin, 400, {
        success: false,
        message: "Datos incompletos",
      });
    }

    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "reserve_public_form_submission",
      {
        p_form_id: formConfig.id,
        p_ip_hash: ipHash,
        p_phone_hash: phoneHash,
        p_window_minutes: RATE_WINDOW_MINUTES,
        p_max_form: MAX_FORM_SUBMISSIONS,
        p_max_ip: MAX_IP_SUBMISSIONS,
        p_max_phone: MAX_PHONE_SUBMISSIONS,
      },
    );

    if (rateLimitError) throw rateLimitError;
    if (rateLimitResult?.allowed !== true) {
      return jsonResponse(responseOrigin, 429, {
        success: false,
        message: "Demasiados intentos. Prob\u00e1 de nuevo m\u00e1s tarde.",
      });
    }

    const treatment = sanitizeText(body.tratamiento, 120, "Consulta general");
    const urgency = sanitizeText(body.urgencia, 80, "No especificado");
    const evaluationPrevious = sanitizeText(body.evaluacion_previa, 120);
    const situation = sanitizeText(body.situacion, 160);
    const consultationReason = sanitizeText(
      body.consultation_reason || body.motivo_consulta || body.situacion || body.tratamiento,
      300,
    ) || null;
    const source = sanitizeText(body.origen || body.source, 120, "Landing odontologia");
    const page = sanitizeText(body.pagina || body.page, 120, "landing");
    const notes = sanitizeText(body.notes, 1000) || null;
    const utmSource = sanitizeText(body.utm_source, 200) || null;
    const utmMedium = sanitizeText(body.utm_medium, 200) || null;
    const utmCampaign = sanitizeText(body.utm_campaign, 240) || null;
    const utmContent = sanitizeText(body.utm_content, 240) || null;
    const utmTerm = sanitizeText(body.utm_term, 240) || null;
    const landingPage = sanitizeText(body.landing_page, 500) || null;
    const referrer = sanitizeText(body.referrer, 500) || null;
    const consentAt = new Date().toISOString();
    const whatsappMessage = encodeURIComponent(
      `Hola ${name}, vimos que dejaste tus datos por ${treatment}. \u00bfQuer\u00e9s que te pasemos los horarios disponibles para una evaluaci\u00f3n?`,
    );
    const whatsappLink = `https://wa.me/${phoneResult.phone}?text=${whatsappMessage}`;

    // All domain writes happen in one Postgres transaction. The Edge Function
    // remains responsible for HTTP, origin, token, consent, anti-spam and rate limits.
    const { data: intakeResult, error: intakeError } = await supabase.rpc(
      "create_public_lead_intake_v2",
      {
        p_form_id: formConfig.id,
        p_clinic_slug: clinicSlug,
        p_public_token: landingToken,
        p_name: name,
        p_phone: phoneResult.phone,
        p_phone_plus: phoneResult.phonePlus,
        p_treatment: treatment,
        p_urgency: urgency,
        p_situation: situation,
        p_evaluation_previous: evaluationPrevious,
        p_consultation_reason: consultationReason,
        p_whatsapp_link: whatsappLink,
        p_source: source,
        p_page: page,
        p_notes: notes,
        p_consent_at: consentAt,
        p_ip_hash: ipHash,
        p_phone_hash: phoneHash,
        p_utm_source: utmSource,
        p_utm_medium: utmMedium,
        p_utm_campaign: utmCampaign,
        p_utm_content: utmContent,
        p_utm_term: utmTerm,
        p_landing_page: landingPage,
        p_referrer: referrer,
      },
    );

    if (intakeError) throw intakeError;

    const result = (intakeResult || {}) as {
      lead_id?: string;
      classification?: string;
      score?: number;
      assigned_to?: string | null;
      created?: boolean;
      new_after_terminal?: boolean;
    };

    return jsonResponse(responseOrigin, 200, {
      success: true,
      message: "Datos enviados correctamente",
      classification: result.classification || null,
      score: result.score ?? null,
      lead_id: result.lead_id,
      assigned: Boolean(result.assigned_to),
      created: Boolean(result.created),
      new_after_terminal: Boolean(result.new_after_terminal),
      clinic_slug: clinicSlug,
    });
  } catch (error) {
    console.error("lead-intake internal error", dbErrorCode(error));
    return jsonResponse(responseOrigin, 500, {
      success: false,
      message: "Error interno",
    });
  }
});
