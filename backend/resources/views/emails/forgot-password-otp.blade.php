<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Password - ISME</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2933;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f8fafc;
        }
        .email-container {
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            margin: 20px;
        }
        .header {
            background: #12b76a;
            color: white;
            padding: 32px 28px 24px 28px;
            text-align: left;
            position: relative;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #12b76a 0%, #0ea765 100%);
        }
        .header-title {
            margin: 0 0 6px 0;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.025em;
        }
        .header-subtitle {
            margin: 0;
            font-size: 13px;
            opacity: 0.9;
        }
        .content {
            padding: 28px;
        }
        .greeting {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 16px;
            letter-spacing: -0.01em;
        }
        .intro-text {
            font-size: 14px;
            color: #4b5563;
            margin-bottom: 24px;
        }
        .otp-box {
            background: #f9fafb;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            padding: 20px 18px;
            text-align: center;
            margin-bottom: 22px;
        }
        .otp-label {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #9ca3af;
            margin-bottom: 8px;
        }
        .otp-code {
            font-size: 28px;
            letter-spacing: 0.35em;
            font-weight: 700;
            color: #111827;
        }
        .otp-expiry {
            font-size: 12px;
            color: #6b7280;
            margin-top: 10px;
        }
        .info-box {
            background: #ecfdf3;
            border-radius: 8px;
            border: 1px solid #bbf7d0;
            padding: 14px 16px;
            font-size: 13px;
            color: #166534;
            margin-bottom: 20px;
        }
        .security-note {
            font-size: 13px;
            color: #4b5563;
            margin-bottom: 4px;
        }
        .small-text {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 0;
        }
        .footer {
            background: #f9fafb;
            padding: 20px 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            margin: 0 0 6px 0;
            font-size: 12px;
            color: #6b7280;
        }
        .footer p:last-child {
            margin-bottom: 0;
        }
        .system-name {
            font-weight: 500;
            color: #111827;
        }
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 6px;
            }
            .header, .content, .footer {
                padding: 22px 18px;
            }
            .otp-code {
                font-size: 24px;
                letter-spacing: 0.25em;
            }
        }
    </style>
</head>
<body>
<div class="email-container">
    <div class="header">
        <h1 class="header-title">Permintaan Reset Password</h1>
        <p class="header-subtitle">ISME - Integrated System Medical Education</p>
    </div>

    <div class="content">
        <p class="greeting">Halo {{ $name }},</p>

        <p class="intro-text">
            Kami menerima permintaan untuk mengatur ulang password akun ISME Anda.
            Silakan gunakan kode OTP berikut untuk melanjutkan proses reset password.
        </p>

        <div class="otp-box">
            <div class="otp-label">Kode OTP Reset Password</div>
            <div class="otp-code">{{ $otp }}</div>
            <div class="otp-expiry">
                Kode ini berlaku selama <strong>10 menit</strong> sejak email ini dikirim.
            </div>
        </div>

        <div class="info-box">
            Jika Anda tidak merasa melakukan permintaan reset password, Anda dapat mengabaikan email ini.
            Password akun Anda akan tetap aman dan tidak berubah.
        </div>

        <p class="security-note">
            Demi keamanan, jangan membagikan kode OTP ini kepada siapa pun, termasuk pihak yang
            mengatasnamakan Admin, Tim Akademik, ataupun pihak lain.
        </p>
        <p class="small-text">
            Untuk melanjutkan proses, kembali ke halaman ISME dan masukkan kode OTP tersebut
            pada form reset password.
        </p>
    </div>

    <div class="footer">
        <p>Terima kasih.</p>
        <p class="system-name">Sistem ISME</p>
        </div>
</div>
</body>
</html>



