<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bug Report - Isme</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            border-left: 4px solid #007bff;
        }
        .priority-high {
            border-left-color: #dc3545;
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
        <h1>🐛 Bug Report</h1>
        <p>Isme</p>
    </div>
    
    <div class="content">
        <div class="field">
            <div class="label">Title:</div>
            <div class="value">{{ $title }}</div>
        </div>
        
        <div class="field">
            <div class="label">Category:</div>
            <div class="value">{{ $category }}</div>
        </div>
        
        <div class="field">
            <div class="label">Priority:</div>
            <div class="value priority-{{ strtolower($priority) }}">{{ $priority }}</div>
        </div>
        
        <div class="field">
            <div class="label">Description:</div>
            <div class="value">{{ $description }}</div>
        </div>
        
        @if($steps_to_reproduce)
        <div class="field">
            <div class="label">Steps to Reproduce:</div>
            <div class="value">{{ $steps_to_reproduce }}</div>
        </div>
        @endif
        
        @if($expected_behavior)
        <div class="field">
            <div class="label">Expected Behavior:</div>
            <div class="value">{{ $expected_behavior }}</div>
        </div>
        @endif
        
        @if($actual_behavior)
        <div class="field">
            <div class="label">Actual Behavior:</div>
            <div class="value">{{ $actual_behavior }}</div>
        </div>
        @endif
        
        <div class="field">
            <div class="label">Reported by:</div>
            <div class="value">{{ $user_name }} ({{ $user_email }})</div>
        </div>
        
        <div class="field">
            <div class="label">Assigned to:</div>
            <div class="value">{{ $developer_name }}</div>
        </div>
    </div>
    
    <div class="footer">
        <p>This bug report was submitted through the Support Center.</p>
        <p>Please respond to the user at: {{ $user_email }}</p>
    </div>
</body>
</html>
