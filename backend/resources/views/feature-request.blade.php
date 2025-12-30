<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Feature Request - ISME</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
            border-left: 4px solid #28a745;
        }
        .priority-critical {
            border-left-color: #dc3545;
        }
        .priority-important {
            border-left-color: #ffc107;
        }
        .priority-nice {
            border-left-color: #6c757d;
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
        <h1>💡 Feature Request</h1>
        <p>ISME</p>
    </div>
    
    <div class="content">
        <div class="field">
            <div class="label">Feature Title:</div>
            <div class="value">{{ $title }}</div>
        </div>
        
        <div class="field">
            <div class="label">Category:</div>
            <div class="value">{{ $category }}</div>
        </div>
        
        <div class="field">
            <div class="label">Priority:</div>
            <div class="value priority-{{ strtolower(str_replace(' ', '-', $priority)) }}">{{ $priority }}</div>
        </div>
        
        <div class="field">
            <div class="label">Description:</div>
            <div class="value">{{ $description }}</div>
        </div>
        
        @if($use_case)
        <div class="field">
            <div class="label">Use Case / Benefit:</div>
            <div class="value">{{ $use_case }}</div>
        </div>
        @endif
        
        <div class="field">
            <div class="label">Requested by:</div>
            <div class="value">{{ $user_name }} ({{ $user_email }})</div>
        </div>
        
        <div class="field">
            <div class="label">Assigned to:</div>
            <div class="value">{{ $developer_name }}</div>
        </div>
    </div>
    
    <div class="footer">
        <p>This feature request was submitted through the Service Center.</p>
        <p>Please respond to the user at: {{ $user_email }}</p>
    </div>
</body>
</html>