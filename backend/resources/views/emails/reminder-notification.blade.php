<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $reminderType === 'unconfirmed' ? 'Pengingat Konfirmasi' : 'Pengingat Persiapan Mengajar' }} - ISME FKK</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            color: white;
            padding: 24px;
            text-align: center;
        }
        .header.unconfirmed {
            background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
        }
        .header.upcoming {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }
        .header h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 24px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #1f2937;
            margin-bottom: 20px;
        }
        .message {
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 16px;
            line-height: 1.5;
        }
        .message.unconfirmed {
            background: #fef3c7;
            border: 1px solid #fbbf24;
        }
        .message.upcoming {
            background: #dbeafe;
            border: 1px solid #93c5fd;
        }
        .schedule-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .schedule-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        .schedule-title::before {
            content: "📅";
            margin-right: 8px;
        }
        .detail-row {
            display: flex;
            margin-bottom: 12px;
            align-items: flex-start;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
            min-width: 80px;
            margin-right: 12px;
        }
        .detail-value {
            color: #1f2937;
            flex: 1;
        }
        .reminder-type-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .reminder-type-badge.unconfirmed {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fbbf24;
        }
        .reminder-type-badge.upcoming {
            background: #dbeafe;
            color: #1e40af;
            border: 1px solid #93c5fd;
        }
        .action-section {
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin-bottom: 24px;
        }
        .action-section.unconfirmed {
            background: #fef3c7;
            border: 1px solid #fbbf24;
        }
        .action-section.upcoming {
            background: #dbeafe;
            border: 1px solid #93c5fd;
        }
        .action-text {
            font-size: 16px;
            font-weight: 500;
            color: #1f2937;
            margin: 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            margin: 0;
            font-size: 14px;
            color: #6b7280;
        }
        .system-name {
            font-weight: 600;
            color: #374151;
        }
        .divider {
            height: 1px;
            background: #e5e7eb;
            margin: 16px 0;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header, .content, .footer {
                padding: 16px;
            }
            .detail-row {
                flex-direction: column;
            }
            .detail-label {
                min-width: auto;
                margin-bottom: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header {{ $reminderType }}">
            <h1>
                {{ $reminderType === 'unconfirmed' ? '🔔 Pengingat Konfirmasi' : '📚 Pengingat Persiapan Mengajar' }}
            </h1>
            <p>ISME FKK - Integrated System Medical Education</p>
        </div>

        <div class="content">
            <div class="greeting">
                Halo {{ $dosen->name }},
            </div>

            <div class="message {{ $reminderType }}">
                {{ $reminderType === 'unconfirmed'
                    ? 'Ini adalah pengingat untuk konfirmasi ketersediaan jadwal mengajar Anda.'
                    : 'Ini adalah pengingat untuk persiapan mengajar jadwal Anda yang akan datang.'
                }}
            </div>

            <div class="schedule-details">
                <div class="schedule-title">
                    Detail Jadwal {{ $jadwalType }}
                </div>

                <div class="detail-row">
                    <div class="detail-label">Jadwal:</div>
                    <div class="detail-value">{{ $jadwal->mataKuliah->nama ?? $jadwal->kategori->nama ?? 'N/A' }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Tanggal:</div>
                    <div class="detail-value">{{ date('d/m/Y', strtotime($jadwal->tanggal)) }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Waktu:</div>
                    <div class="detail-value">{{ str_replace(':', '.', $jadwal->jam_mulai) }} - {{ str_replace(':', '.', $jadwal->jam_selesai) }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Ruangan:</div>
                    <div class="detail-value">{{ $jadwal->ruangan->nama ?? 'TBD' }}</div>
                </div>

                @if(isset($jadwal->topik) && $jadwal->topik)
                <div class="detail-row">
                    <div class="detail-label">Topik:</div>
                    <div class="detail-value">{{ $jadwal->topik }}</div>
                </div>
                @endif

                @if(isset($jadwal->materi) && $jadwal->materi)
                <div class="detail-row">
                    <div class="detail-label">Materi:</div>
                    <div class="detail-value">{{ $jadwal->materi }}</div>
                </div>
                @endif

                @if(isset($jadwal->agenda) && $jadwal->agenda)
                <div class="detail-row">
                    <div class="detail-label">Agenda:</div>
                    <div class="detail-value">{{ $jadwal->agenda }}</div>
                </div>
                @endif

                <div class="divider"></div>

                <div class="detail-row">
                    <div class="detail-label">Jenis:</div>
                    <div class="detail-value">
                        <span class="reminder-type-badge {{ $reminderType }}">
                            {{ $reminderType === 'unconfirmed' ? 'Belum Konfirmasi' : 'Persiapan Mengajar' }}
                        </span>
                    </div>
                </div>
            </div>

            <div class="action-section {{ $reminderType }}">
                <p class="action-text">
                    {{ $reminderType === 'unconfirmed'
                        ? 'Silakan login ke sistem untuk konfirmasi ketersediaan Anda.'
                        : 'Silakan persiapkan diri untuk mengajar sesuai jadwal di atas.'
                    }}
                </p>
            </div>
        </div>

        <div class="footer">
            <p>Terima kasih.</p>
            <p class="system-name">Sistem ISME FKK</p>
            <p>Fakultas Kedokteran dan Kesehatan<br>Universitas Muhammadiyah Jakarta</p>
        </div>
    </div>
</body>
</html>
