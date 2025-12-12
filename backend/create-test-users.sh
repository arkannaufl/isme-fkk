#!/bin/bash

# Script untuk Create Test Users Khusus untuk Load Testing
# Create users dengan password yang diketahui untuk testing

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TEST_PASSWORD="${TEST_PASSWORD:-test123}"
ROLE="${ROLE:-mahasiswa}"
COUNT="${COUNT:-50}"
PREFIX="${PREFIX:-testuser}"

# Function untuk print header
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Create Test Users untuk Load Testing${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function untuk help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -r, --role ROLE          Role untuk test users (mahasiswa/dosen, default: mahasiswa)"
    echo "  -p, --password PASSWORD  Password untuk semua test users (default: test123)"
    echo "  -c, --count NUM          Jumlah test users yang akan dibuat (default: 50)"
    echo "  -x, --prefix PREFIX     Prefix untuk username (default: testuser)"
    echo "  -h, --help               Show this help"
    echo ""
    echo "Examples:"
    echo "  # Create 50 test users (role mahasiswa, password: test123)"
    echo "  $0 -r mahasiswa -p test123 -c 50"
    echo ""
    echo "  # Create 100 test users untuk dosen"
    echo "  $0 -r dosen -p test123 -c 100"
    echo ""
    echo "  # Create dengan prefix custom"
    echo "  $0 -r mahasiswa -p test123 -c 50 -x loadtest"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--role)
            ROLE="$2"
            shift 2
            ;;
        -p|--password)
            TEST_PASSWORD="$2"
            shift 2
            ;;
        -c|--count)
            COUNT="$2"
            shift 2
            ;;
        -x|--prefix)
            PREFIX="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if we're in backend directory
if [ ! -f "artisan" ]; then
    echo -e "${RED}Error: Script harus dijalankan dari direktori backend${NC}"
    echo "Contoh: cd /var/www/isme-fkk/backend && ./create-test-users.sh"
    exit 1
fi

print_header

echo -e "${YELLOW}Konfigurasi:${NC}"
echo -e "  Role: ${BLUE}${ROLE}${NC}"
echo -e "  Password: ${BLUE}${TEST_PASSWORD}${NC}"
echo -e "  Jumlah: ${BLUE}${COUNT}${NC}"
echo -e "  Prefix: ${BLUE}${PREFIX}${NC}"
echo ""

# Confirmation
read -p "Apakah Anda yakin ingin membuat ${COUNT} test users? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Dibatalkan.${NC}"
    exit 0
fi

echo -e "${YELLOW}Creating test users...${NC}"

# Create users using Laravel Tinker
php artisan tinker --execute="
use App\Models\User;
use Illuminate\Support\Facades\Hash;

\$created = 0;
\$skipped = 0;

for (\$i = 1; \$i <= ${COUNT}; \$i++) {
    \$username = '${PREFIX}' . \$i;
    \$email = '${PREFIX}' . \$i . '@test.local';
    
    // Check if user already exists
    \$existing = User::where('username', \$username)
        ->orWhere('email', \$email)
        ->first();
    
    if (\$existing) {
        // Update password if exists
        \$existing->password = Hash::make('${TEST_PASSWORD}');
        \$existing->is_logged_in = 0;
        \$existing->current_token = null;
        \$existing->save();
        \$skipped++;
        continue;
    }
    
    // Create new user
    \$userData = [
        'name' => 'Test User ' . \$i,
        'username' => \$username,
        'email' => \$email,
        'password' => Hash::make('${TEST_PASSWORD}'),
        'role' => '${ROLE}',
        'is_logged_in' => 0,
        'current_token' => null,
    ];
    
    // Add role-specific fields
    if ('${ROLE}' === 'mahasiswa') {
        \$userData['nim'] = 'TEST' . str_pad(\$i, 6, '0', STR_PAD_LEFT);
        \$userData['semester'] = rand(1, 8);
        \$userData['status'] = 'aktif';
    } elseif ('${ROLE}' === 'dosen') {
        \$userData['nip'] = 'TEST' . str_pad(\$i, 6, '0', STR_PAD_LEFT);
        \$userData['nid'] = 'TEST' . str_pad(\$i, 6, '0', STR_PAD_LEFT);
    }
    
    User::create(\$userData);
    \$created++;
    
    if (\$i % 10 === 0) {
        echo 'Created: ' . \$i . ' users...' . PHP_EOL;
    }
}

echo 'DONE:' . \$created . ':' . \$skipped . PHP_EOL;
" 2>/dev/null

# Check result
RESULT=$(php artisan tinker --execute="
\$count = \App\Models\User::where('username', 'like', '${PREFIX}%')
    ->where('role', '${ROLE}')
    ->count();
echo \$count;
" 2>/dev/null)

if [ -z "$RESULT" ] || [ "$RESULT" -eq 0 ]; then
    echo -e "${RED}Error: Gagal membuat test users${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Berhasil membuat/update test users${NC}"
echo -e "  Total test users: ${BLUE}${RESULT}${NC}"
echo ""

# Generate users.txt file
OUTPUT_FILE="users_${ROLE}_test.txt"
echo -e "${YELLOW}Generating ${OUTPUT_FILE}...${NC}"

# Check if we can write to current directory, if not use /tmp
OUTPUT_DIR="."
if [ ! -w "." ]; then
    OUTPUT_DIR="/tmp"
    OUTPUT_FILE="${OUTPUT_DIR}/$(basename ${OUTPUT_FILE})"
    echo -e "${YELLOW}⚠ Tidak bisa write ke direktori saat ini, menggunakan ${OUTPUT_DIR}${NC}"
fi

php artisan tinker --execute="
\$users = \App\Models\User::where('username', 'like', '${PREFIX}%')
    ->where('role', '${ROLE}')
    ->select('username')
    ->get();

foreach (\$users as \$user) {
    echo \$user->username . PHP_EOL;
}
" > /tmp/test_users_list.txt 2>/dev/null

# Write users.txt to temp file first, then move
TEMP_OUTPUT=$(mktemp)
cat > "$TEMP_OUTPUT" << EOF
# Test Users untuk Load Testing
# Generated: $(date)
# Role: ${ROLE}
# Password: ${TEST_PASSWORD}
# Total Users: ${RESULT}
#
# Format: username:password
# Gunakan dengan: ./test-login-load.sh -f ${OUTPUT_FILE} -c 50 -t 100
#

EOF

while IFS= read -r username; do
    if [ -n "$username" ]; then
        echo "${username}:${TEST_PASSWORD}" >> "$TEMP_OUTPUT"
    fi
done < /tmp/test_users_list.txt

rm -f /tmp/test_users_list.txt

# Try to move/copy file to final location
if cp "$TEMP_OUTPUT" "$OUTPUT_FILE" 2>/dev/null; then
    chmod 644 "$OUTPUT_FILE" 2>/dev/null || true
    rm -f "$TEMP_OUTPUT"
elif sudo cp "$TEMP_OUTPUT" "$OUTPUT_FILE" 2>/dev/null; then
    sudo chmod 644 "$OUTPUT_FILE" 2>/dev/null || true
    rm -f "$TEMP_OUTPUT"
    echo -e "${YELLOW}⚠ File dibuat dengan sudo, mungkin perlu sudo untuk read${NC}"
else
    # If still fails, use temp file location
    OUTPUT_FILE="$TEMP_OUTPUT"
    echo -e "${YELLOW}⚠ Tidak bisa write ke direktori, file disimpan di: ${OUTPUT_FILE}${NC}"
fi

# Check if file was created successfully
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}Error: File ${OUTPUT_FILE} tidak berhasil dibuat${NC}"
    echo -e "${YELLOW}Solusi:${NC}"
    echo -e "  1. Jalankan dengan sudo: ${BLUE}sudo ./create-test-users.sh${NC}"
    echo -e "  2. Atau fix permission: ${BLUE}sudo chown -R \$USER:\$USER /var/www/isme-fkk/backend${NC}"
    exit 1
fi

# Fix permission if needed
if [ -w "$OUTPUT_FILE" ]; then
    chmod 644 "$OUTPUT_FILE" 2>/dev/null || true
else
    sudo chmod 644 "$OUTPUT_FILE" 2>/dev/null || true
fi

echo -e "${GREEN}✓ File ${OUTPUT_FILE} berhasil dibuat${NC}"
echo -e "  Lokasi: ${BLUE}${OUTPUT_FILE}${NC}"
echo ""

# Show first 5 users as preview
if [ -r "$OUTPUT_FILE" ]; then
    echo -e "${YELLOW}Preview (5 pertama):${NC}"
    head -n 10 "$OUTPUT_FILE" | grep -v '^#' | head -n 5
    echo ""
else
    echo -e "${YELLOW}⚠ Tidak bisa read file untuk preview (permission issue)${NC}"
    echo ""
fi

# Instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Cara menggunakan:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "# Test dengan file users.txt:"
echo -e "${YELLOW}./test-login-load.sh -f ${OUTPUT_FILE} -c 50 -t 100${NC}"
echo ""
echo -e "# Atau test dengan 1 user:"
echo -e "${YELLOW}./test-login-load.sh -u ${PREFIX}1 -p ${TEST_PASSWORD} -c 100 -t 100${NC}"
echo ""
echo -e "${YELLOW}⚠ Catatan:${NC}"
echo -e "  - Test users sudah dibuat dengan password: ${BLUE}${TEST_PASSWORD}${NC}"
echo -e "  - Username format: ${BLUE}${PREFIX}1, ${PREFIX}2, ${PREFIX}3, ...${NC}"
echo -e "  - File ${OUTPUT_FILE} sudah siap digunakan"
echo ""

