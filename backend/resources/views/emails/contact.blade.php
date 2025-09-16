<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Contact Message - Isme</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
        }
        .field {
            margin-bottom: 15px;
        }
        .label {
            font-weight: bold;
            color: #495057;
        }
        .value {
            background: white;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #6f42c1;
        }
        .priority-urgent {
            border-left-color: #dc3545;
        }
        .priority-high {
            border-left-color: #fd7e14;
        }
        .priority-medium {
            border-left-color: #ffc107;
        }
        .priority-low {
            border-left-color: #28a745;
        }
        .footer {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            font-size: 12px;
            color: #6c757d;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📧 Contact Message</h1>
        <p>Isme</p>
    </div>
    
    <div class="content">
        <div class="field">
            <div class="label">Subject:</div>
            <div class="value">{{ $subject ?? 'No Subject' }}</div>
        </div>
        
        <div class="field">
            <div class="label">Priority:</div>
            <div class="value priority-{{ strtolower($priority ?? 'medium') }}">{{ $priority ?? 'Medium' }}</div>
        </div>
        
        <div class="field">
            <div class="label">Message:</div>
            <div class="value">{{ $message ?? 'No Message' }}</div>
        </div>
        
        <div class="field">
            <div class="label">From:</div>
            <div class="value">{{ $user_name ?? 'Unknown User' }} ({{ $user_email ?? 'No Email' }})</div>
        </div>
        
        <div class="field">
            <div class="label">Assigned to:</div>
            <div class="value">{{ $developer_name ?? 'No Developer' }}</div>
        </div>
    </div>
    
    <div class="footer">
        <p>This message was sent through the Support Center.</p>
        <p>Please respond to the user at: {{ $user_email }}</p>
    </div>
</body>
</html>
