<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $reminderType === 'unconfirmed' ? 'Pengingat Konfirmasi' : 'Pengingat Persiapan Mengajar' }} - ISME FKK</title>
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
            background: #12b76a;
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
            background: linear-gradient(90deg, #12b76a 0%, #10a85c 100%);
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
            border-left: 3px solid #12b76a;
        }
        .schedule-details {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            margin-bottom: 32px;
        }
        .schedule-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 24px;
            letter-spacing: -0.025em;
            display: flex;
            align-items: center;
        }
        .schedule-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #12b76a;
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
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .status-badge.unconfirmed {
            background: #fef3c7;
            color: #92400e;
        }
        .status-badge.upcoming {
            background: #dbeafe;
            color: #1e40af;
        }
        .action-section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            text-align: center;
            margin-bottom: 32px;
        }
        .action-text {
            font-size: 15px;
            font-weight: 400;
            color: #4a5568;
            margin: 0 0 20px 0;
            line-height: 1.6;
        }
        .cta-button {
            display: inline-block;
            background: #12b76a;
            color: white !important;
            padding: 14px 28px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            font-size: 15px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        .cta-button:hover {
            background: #10a85c;
            color: white !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
            <h1>
                {{ $reminderType === 'unconfirmed' ? 'Pengingat Konfirmasi' : 'Pengingat Persiapan Mengajar' }}
            </h1>
            <p>ISME FKK - Integrated System Medical Education</p>
        </div>

        <div class="content">
            <div class="greeting">
                Halo {{ $dosen->name }},
            </div>

            <div class="message">
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

                @if(isset($jadwal->mataKuliah) && $jadwal->mataKuliah)
                <div class="detail-row">
                    <div class="detail-label">Semester & Blok:</div>
                    <div class="detail-value">
                        Semester {{ $jadwal->mataKuliah->semester }}
                        @if($jadwal->mataKuliah->blok)
                            - Blok {{ $jadwal->mataKuliah->blok }}
                        @endif
                    </div>
                </div>
                @elseif(isset($jadwal->kategori) && $jadwal->kategori)
                <div class="detail-row">
                    <div class="detail-label">Semester & Blok:</div>
                    <div class="detail-value">
                        Semester {{ $jadwal->kategori->semester }}
                        @if($jadwal->kategori->blok)
                            - Blok {{ $jadwal->kategori->blok }}
                        @endif
                    </div>
                </div>
                @endif

                @if(isset($isKoordinator) && !$isKoordinator && isset($koordinatorList) && !empty($koordinatorList))
                <div class="detail-row">
                    <div class="detail-label">Koordinator Dosen:</div>
                    <div class="detail-value">
                        @foreach($koordinatorList as $index => $koordinatorName)
                            {{ $koordinatorName }}@if($index < count($koordinatorList) - 1), @endif
                        @endforeach
                    </div>
                </div>
                @endif

                <div class="detail-row">
                    <div class="detail-label">Ruangan:</div>
                    <div class="detail-value">
                        @if(isset($jadwal->use_ruangan) && $jadwal->use_ruangan && $jadwal->ruangan)
                            {{ $jadwal->ruangan->nama }} (Offline)
                        @else
                            Online
                        @endif
                    </div>
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

                @if(isset($isKoordinator) && $isKoordinator && isset($pengampuList) && !empty($pengampuList))
                <div class="divider"></div>
                <div class="detail-row">
                    <div class="detail-label">Dosen Pengampu:</div>
                    <div class="detail-value">
                        @foreach($pengampuList as $index => $pengampuName)
                            {{ $pengampuName }}@if($index < count($pengampuList) - 1), @endif
                        @endforeach
                    </div>
                </div>
                @endif

                <div class="divider"></div>

                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="status-badge {{ $reminderType }}">
                            {{ $reminderType === 'unconfirmed' ? 'Belum Konfirmasi' : 'Persiapan Mengajar' }}
                        </span>
                    </div>
                </div>
            </div>

            <div class="action-section">
                <p class="action-text">
                    {{ $reminderType === 'unconfirmed'
                        ? 'Silakan login ke sistem untuk konfirmasi ketersediaan Anda.'
                        : 'Silakan persiapkan diri untuk mengajar sesuai jadwal di atas.'
                    }}
                </p>
                @if($reminderType === 'unconfirmed')
                <a href="{{ env('APP_ENV') === 'local' ? 'http://localhost:5173' : 'https://isme.fkkumj.ac.id' }}/dashboard" class="cta-button">
                    Konfirmasi Ketersediaan
                </a>
                @endif
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
