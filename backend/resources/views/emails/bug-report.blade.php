<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bug Report - FK UMJ Service Center</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f8fafc;
        }
        .email-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            margin: 20px;
        }
        .header {
            background: #dc2626;
            color: white;
            padding: 40px 32px;
            text-align: center;
            position: relative;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #dc2626 0%, #b91c1c 100%);
        }
        .header h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.025em;
        }
        .header p {
            margin: 0;
            font-size: 14px;
            opacity: 0.9;
            font-weight: 400;
        }
        .content {
            padding: 40px 32px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
        }
        .message {
            background: #f8fafc;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 32px;
            font-size: 15px;
            line-height: 1.6;
            color: #4a5568;
            border-left: 3px solid #dc2626;
        }
        .ticket-details {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            margin-bottom: 32px;
        }
        .ticket-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
            display: flex;
            align-items: center;
        }
        .ticket-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #dc2626;
            margin-right: 12px;
            border-radius: 2px;
        }
        .detail-row {
            display: flex;
            margin-bottom: 16px;
            align-items: flex-start;
            padding: 0;
        }
        .detail-row:last-child {
            margin-bottom: 0;
        }
        .detail-label {
            font-weight: 500;
            color: #64748b;
            min-width: 120px;
            margin-right: 16px;
            font-size: 14px;
        }
        .detail-value {
            color: #2c3e50;
            flex: 1;
            font-size: 15px;
            font-weight: 400;
        }
        .priority-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .priority-badge.critical {
            background: #fef2f2;
            color: #dc2626;
        }
        .priority-badge.high {
            background: #fff7ed;
            color: #ea580c;
        }
        .priority-badge.medium {
            background: #fffbeb;
            color: #d97706;
        }
        .priority-badge.low {
            background: #f0fdf4;
            color: #16a34a;
        }
        .ticket-number {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            font-weight: 600;
            color: #dc2626;
            background: #fef2f2;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 13px;
        }
        .contact-section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            text-align: center;
            margin-bottom: 32px;
        }
        .contact-text {
            font-size: 15px;
            font-weight: 400;
            color: #4a5568;
            margin: 0 0 20px 0;
            line-height: 1.6;
        }
        .footer {
            background: #f8fafc;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #64748b;
            line-height: 1.5;
        }
        .footer p:last-child {
            margin-bottom: 0;
        }
        .system-name {
            font-weight: 500;
            color: #2c3e50;
        }
        .divider {
            height: 1px;
            background: #e2e8f0;
            margin: 24px 0;
        }
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 6px;
            }
            .header, .content, .footer {
                padding: 24px 20px;
            }
            .detail-row {
                flex-direction: column;
                align-items: flex-start;
            }
            .detail-label {
                min-width: auto;
                margin-bottom: 4px;
                margin-right: 0;
            }
            .header h1 {
                font-size: 20px;
            }
            .greeting {
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🐛 Bug Report</h1>
            <p>FK UMJ Service Center</p>
        </div>

        <div class="content">
            <div class="greeting">
                Halo {{ $developer_name }},
            </div>

            <div class="message">
                Ini adalah laporan bug baru yang telah diterima melalui Service Center FK UMJ. Silakan segera tangani sesuai dengan prioritas yang ditentukan.
            </div>

            <div class="ticket-details">
                <div class="ticket-title">
                    Detail Laporan Bug
                </div>

                <div class="detail-row">
                    <div class="detail-label">Tiket #:</div>
                    <div class="detail-value">
                        <span class="ticket-number">{{ $ticket_number ?? 'TK-XXXXXXXX' }}</span>
                    </div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Dilaporkan oleh:</div>
                    <div class="detail-value">{{ $user_name }} ({{ $user_email }})</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Tanggal:</div>
                    <div class="detail-value">{{ date('d/m/Y H:i', strtotime(now())) }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Judul:</div>
                    <div class="detail-value">{{ $title }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Kategori:</div>
                    <div class="detail-value">{{ $category }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Prioritas:</div>
                    <div class="detail-value">
                        <span class="priority-badge {{ strtolower($priority) }}">{{ $priority }}</span>
                    </div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Deskripsi:</div>
                    <div class="detail-value">{{ $description }}</div>
                </div>

                @if(!empty($steps_to_reproduce))
                <div class="divider"></div>
                <div class="detail-row">
                    <div class="detail-label">Langkah Reproduksi:</div>
                    <div class="detail-value">{{ $steps_to_reproduce }}</div>
                </div>
                @endif

                @if(!empty($expected_behavior) || !empty($actual_behavior))
                <div class="divider"></div>
                @if(!empty($expected_behavior))
                <div class="detail-row">
                    <div class="detail-label">Perilaku Diharapkan:</div>
                    <div class="detail-value">{{ $expected_behavior }}</div>
                </div>
                @endif
                @if(!empty($actual_behavior))
                <div class="detail-row">
                    <div class="detail-label">Perilaku Terjadi:</div>
                    <div class="detail-value">{{ $actual_behavior }}</div>
                </div>
                @endif
                @endif
            </div>

            <div class="contact-section">
                <p class="contact-text">
                    Silakan segera tangani laporan bug ini sesuai dengan SLA yang telah ditetapkan. 
                    Jika memerlukan informasi tambahan, silakan hubungi pelapor melalui email.
                </p>
            </div>
        </div>

        <div class="footer">
            <p>Terima kasih.</p>
            <p class="system-name">FK UMJ Service Center</p>
            <p>Fakultas Kedokteran Universitas Muhammadiyah Jakarta<br>Email: support@fk.umj.ac.id</p>
        </div>
    </div>
</body>
</html>