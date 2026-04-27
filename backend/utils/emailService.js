const EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send";

const leaveTypeMap = {
  odihna: "Concediu de odihnă",
  medical: "Concediu medical",
  fara_plata: "Concediu fără plată",
  eveniment: "Concediu pentru eveniment special",
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

async function sendEmailViaEmailJs({
  templateId,
  toEmail,
  leaveData,
  subjectPrefix,
}) {
  try {
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const serviceId = process.env.EMAILJS_SERVICE_ID;

    if (!publicKey || !serviceId || !templateId) {
      console.error("❌ EROARE EMAILJS: variabile de mediu lipsă", {
        hasPublicKey: Boolean(publicKey),
        hasServiceId: Boolean(serviceId),
        hasTemplateId: Boolean(templateId),
      });
      return { success: false, error: "Variabile de mediu lipsă" };
    }

    if (!privateKey) {
      console.error("❌ EROARE EMAILJS_PRIVATE_KEY lipsă");
      return { success: false, error: "Private Key lipsă - necesar pentru strict mode" };
    }

    const leaveTypeLabel = leaveTypeMap[leaveData.type] || leaveData.type;

    const templateParams = {
      employee_name: leaveData.employee_name || "Necunoscut",
      workplace_name: leaveData.workplace_name || "",
      function: leaveData.function || "",
      leave_type_label: leaveTypeLabel,
      start_date: formatDate(leaveData.startDate),
      end_date: formatDate(leaveData.endDate),
      days: leaveData.days?.toString() || "0",
      reason: leaveData.reason || "",
      direct_supervisor_name: leaveData.directSupervisorName || "",
      to_email: toEmail,
      status: leaveData.status || "",
      subject_prefix: subjectPrefix || "",
    };

    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams,
    };

    const response = await fetch(EMAILJS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`EmailJS API returned ${response.status}: ${responseText}`);
    }

    return { success: true, response: { status: response.status, text: responseText } };
  } catch (error) {
    console.error("❌ EROARE TRIMITERE EMAIL:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Trimite email notificare pentru cerere de concediu nouă
 */
async function sendLeaveRequestNotification(leaveData) {
  const toEmail = process.env.EMAILJS_TO_EMAIL;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;

  if (!toEmail) {
    console.error("❌ EROARE EMAILJS_TO_EMAIL lipsă");
    return { success: false, error: "EMAILJS_TO_EMAIL lipsă" };
  }

  return sendEmailViaEmailJs({
    templateId,
    toEmail,
    leaveData,
    subjectPrefix: "Cerere nouă",
  });
}

/**
 * Trimite email notificare pentru cerere aprobată de manager
 */
async function sendLeaveApprovedNotification(leaveData) {
  const toEmail = process.env.EMAILJS_APPROVED_TO_EMAIL || process.env.EMAILJS_TO_EMAIL;
  const templateId = process.env.EMAILJS_APPROVED_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;

  if (!toEmail) {
    console.error("❌ EROARE EMAILJS_APPROVED_TO_EMAIL/EMAILJS_TO_EMAIL lipsă");
    return { success: false, error: "EMAILJS_APPROVED_TO_EMAIL/EMAILJS_TO_EMAIL lipsă" };
  }

  return sendEmailViaEmailJs({
    templateId,
    toEmail,
    leaveData: {
      ...leaveData,
      status: "Aprobată",
    },
    subjectPrefix: "Cerere aprobată",
  });
}

module.exports = {
  sendLeaveRequestNotification,
  sendLeaveApprovedNotification,
};
