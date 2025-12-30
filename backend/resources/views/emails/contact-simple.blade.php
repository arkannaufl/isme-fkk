<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Contact Message - ISME</title>
</head>
<body>
    <h2>📧 Contact Message</h2>
    <p><strong>Subject:</strong> {{ $subject }}</p>
    <p><strong>Priority:</strong> {{ $priority }}</p>
    <p><strong>Message:</strong></p>
    <p>{{ $message }}</p>
    <p><strong>From:</strong> {{ $user_name }} ({{ $user_email }})</p>
    <p><strong>Assigned to:</strong> {{ $developer_name }}</p>
    <hr>
    <p><em>This message was sent through the Service Center.</em></p>
</body>
</html>
