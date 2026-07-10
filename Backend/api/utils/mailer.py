import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Configure standard logger
logger = logging.getLogger("mendcode.mailer")
logging.basicConfig(level=logging.INFO)

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@mendcode.com")

# Branded HTML email template
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MendCode Verification</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
    }}
    .email-container {{
      max-width: 580px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1e293b;
      border-radius: 12px;
      border: 1px solid #334155;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }}
    .header {{
      text-align: center;
      margin-bottom: 24px;
    }}
    .logo {{
      color: #06b6d4;
      font-size: 24px;
      font-weight: 800;
      text-decoration: none;
      letter-spacing: -0.5px;
    }}
    .content {{
      font-size: 16px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 32px;
    }}
    .code-box {{
      text-align: center;
      background-color: #0f172a;
      border: 2px dashed #06b6d4;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }}
    .code {{
      font-family: "Courier New", Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #06b6d4;
      margin: 0;
    }}
    .footer {{
      text-align: center;
      font-size: 13px;
      color: #64748b;
      border-top: 1px solid #334155;
      padding-top: 24px;
      margin-top: 32px;
    }}
    .footer a {{
      color: #06b6d4;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <a href="https://github.com/DakshDashora/MendCode" class="logo">MendCode</a>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Thank you for signing up for MendCode! Use the verification code below to activate your account and complete registration:</p>
      
      <div class="code-box">
        <p class="code">{otp}</p>
      </div>
      
      <p style="font-size: 14px; color: #94a3b8;">This code is valid for <strong>10 minutes</strong>. If you did not request this sign-up, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; {year} MendCode. All rights reserved.</p>
      <p>Need support? Open an issue on our <a href="https://github.com/DakshDashora/MendCode/issues">GitHub Repository</a>.</p>
    </div>
  </div>
</body>
</html>
"""

def send_otp_email(to_email: str, otp: str):
    """
    Sends a styled HTML OTP email. If SMTP environment variables are not set,
    simulates the email by printing a clean block directly to the server terminal.
    """
    from datetime import datetime
    year = datetime.now().year
    
    subject = "MendCode Verification Code"
    plain_body = f"Your MendCode sign-up verification code is: {otp}\nThis code will expire in 10 minutes."
    html_body = HTML_TEMPLATE.format(otp=otp, year=year)

    if all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD]):
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = SMTP_FROM
            msg["To"] = to_email
            msg["Subject"] = subject
            
            # Attach plain text and HTML versions
            msg.attach(MIMEText(plain_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            # Standard secure SMTP execution with a 10s connection timeout
            server = smtplib.SMTP(SMTP_HOST, int(SMTP_PORT), timeout=10)
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
            server.quit()
            logger.info(f"Verification OTP email successfully sent via SMTP to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            raise e
    else:
        # Console Simulation Fallback (Only runs if variables are NOT set at all)
        print("\n" + "*" * 60)
        print(f"               MENDCODE OTP SIMULATION SERVICE")
        print(f"   Sent Verification OTP to: {to_email}")
        print(f"   Your OTP Code is:         {otp}")
        print("*" * 60 + "\n")
        return True
