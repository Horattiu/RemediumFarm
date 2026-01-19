/**
 * Trimite email notificare pentru cerere de concediu nouă
 * Folosim EmailJS API direct (simplu, ca în browser)
 */
async function sendLeaveRequestNotification(leaveData) {
  try {
    console.log("═══════════════════════════════════════");
    console.log("📧 TRIMITERE EMAIL NOTIFICARE");
    console.log("═══════════════════════════════════════");
    
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const toEmail = process.env.EMAILJS_TO_EMAIL || "horatiu.olt@gmail.com";
    
    console.log("🔍 CONFIGURAȚIE EMAILJS:");
    console.log("   PUBLIC_KEY:", publicKey ? `${publicKey.substring(0, 10)}...` : "LIPSĂ");
    console.log("   PRIVATE_KEY:", privateKey ? `${privateKey.substring(0, 10)}... (lungime: ${privateKey.length})` : "LIPSĂ");
    console.log("   PRIVATE_KEY complet:", privateKey ? "DA" : "NU");
    console.log("   SERVICE_ID:", serviceId || "LIPSĂ");
    console.log("   TEMPLATE_ID:", templateId || "LIPSĂ");
    console.log("   TO_EMAIL:", toEmail);
    
    // Debug: verifică toate variabilele de mediu EmailJS
    console.log("🔍 DEBUG ENV VARIABLES:");
    console.log("   process.env.EMAILJS_PUBLIC_KEY:", process.env.EMAILJS_PUBLIC_KEY ? "EXISTĂ" : "LIPSĂ");
    console.log("   process.env.EMAILJS_PRIVATE_KEY:", process.env.EMAILJS_PRIVATE_KEY ? "EXISTĂ" : "LIPSĂ");
    console.log("   process.env.EMAILJS_SERVICE_ID:", process.env.EMAILJS_SERVICE_ID ? "EXISTĂ" : "LIPSĂ");
    console.log("   process.env.EMAILJS_TEMPLATE_ID:", process.env.EMAILJS_TEMPLATE_ID ? "EXISTĂ" : "LIPSĂ");
    
    if (!publicKey || !serviceId || !templateId) {
      console.error("❌ EROARE: Variabile de mediu lipsă!");
      console.error("   PUBLIC_KEY:", publicKey ? "OK" : "LIPSĂ");
      console.error("   SERVICE_ID:", serviceId ? "OK" : "LIPSĂ");
      console.error("   TEMPLATE_ID:", templateId ? "OK" : "LIPSĂ");
      return { success: false, error: "Variabile de mediu lipsă" };
    }
    
    // În strict mode, Private Key este obligatoriu pentru server-side calls
    if (!privateKey) {
      console.error("❌ EROARE: EMAILJS_PRIVATE_KEY lipsă!");
      console.error("   Contul EmailJS este în 'strict mode' și necesită Private Key pentru apeluri server-side.");
      console.error("   Găsește Private Key în EmailJS Dashboard → Account → Security");
      return { success: false, error: "Private Key lipsă - necesar pentru strict mode" };
    }
    
    // Verifică lungimea Private Key-ului (ar trebui să fie 32+ caractere)
    if (privateKey.length < 20) {
      console.error("❌ ATENȚIE: Private Key pare prea scurt!");
      console.error(`   Lungime actuală: ${privateKey.length} caractere`);
      console.error("   Un Private Key EmailJS valid are de obicei 32+ caractere.");
      console.error("   Te rugăm să verifici că ai copiat complet Private Key-ul din EmailJS Dashboard.");
      console.error("   Private Key parțial (primele 10):", privateKey.substring(0, 10));
    }
    
    // Mapează tipurile de concediu
    const leaveTypeMap = {
      odihna: "Concediu de odihnă",
      medical: "Concediu medical",
      fara_plata: "Concediu fără plată",
      eveniment: "Concediu pentru eveniment special",
    };

    const leaveTypeLabel = leaveTypeMap[leaveData.type] || leaveData.type;

    // Formatează datele
    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    // Parametrii template
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
    };

    console.log("📋 Parametrii:", templateParams);

    // EmailJS API endpoint - pentru server-side în strict mode
    // În strict mode, Private Key trebuie în BODY ca accessToken (NU în query string!)
    const emailjsApiUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    // Payload pentru strict mode - accessToken trebuie în body (nu în URL!)
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey, // Public Key în user_id
      accessToken: privateKey, // ✅ Private Key în body ca accessToken (NU în query string!)
      template_params: templateParams,
    };

    console.log("📤 Trimitere către EmailJS API (STRICT MODE)...");
    console.log("   URL:", emailjsApiUrl);
    console.log("   Private Key setat:", privateKey ? "DA" : "NU");
    console.log("   Payload (simplificat):", {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey ? `${publicKey.substring(0, 10)}... (Public Key)` : "LIPSĂ",
      accessToken: privateKey ? "SETAT (în body)" : "LIPSĂ",
      note: "✅ În strict mode: user_id = Public Key, accessToken = Private Key (în body)",
    });
    
    // Folosim fetch (Node.js 18+ are fetch built-in)
    // În strict mode: accessToken trebuie în BODY (nu în query string!)
    const response = await fetch(emailjsApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (response.ok) {
      console.log("✅ EMAIL TRIMIS CU SUCCES!");
      console.log("   Status:", response.status);
      console.log("   Response:", responseText);
      console.log("═══════════════════════════════════════");
      return { success: true, response: { status: response.status, text: responseText } };
    } else {
      throw new Error(`EmailJS API returned ${response.status}: ${responseText}`);
    }
  } catch (error) {
    console.error("═══════════════════════════════════════");
    console.error("❌ EROARE TRIMITERE EMAIL:");
    console.error("   Message:", error.message);
    console.error("   Full Error:", error);
    console.error("═══════════════════════════════════════");
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendLeaveRequestNotification,
};
