#!/bin/bash

# Script untuk Setup Test Users untuk Load Testing
# Generate file users.txt dari database (untuk data real, user harus tahu password-nya)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-password}"
OUTPUT_FILE="${OUTPUT_FILE:-users.txt}"
ROLE="${ROLE:-mahasiswa}"
LIMIT="${LIMIT:-100}"

# Function untuk print header
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Setup Test Users untuk Load Testing${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function untuk help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -r, --role ROLE          Role untuk ambil users (mahasiswa/dosen, default: mahasiswa)"
    echo "  -p, --password PASSWORD  Password untuk semua users (default: password)"
    echo "  -o, --output FILE       Output file (default: users.txt)"
    echo "  -l, --limit NUM          Limit jumlah users (default: 100)"
    echo "  -h, --help               Show this help"
    echo ""
    echo "Examples:"
    echo "  # Generate users.txt dari database (asumsi semua password sama)"
    echo "  $0 -r mahasiswa -p password123"
    echo ""
    echo "  # Generate users.txt untuk dosen"
    echo "  $0 -r dosen -p password123"
    echo ""
    echo "  ⚠️  PENTING: Script ini hanya generate username, password harus diketahui user"
    echo "  Untuk data real, gunakan create-test-users.sh untuk buat test users khusus"
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
            DEFAULT_PASSWORD="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -l|--limit)
            LIMIT="$2"
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
    echo "Contoh: cd /var/www/isme-fkk/backend && ./setup-test-users.sh"
    exit 1
fi

print_header

echo -e "${YELLOW}Mengambil users dari database...${NC}"
echo -e "Role: ${BLUE}${ROLE}${NC}"
echo -e "Password: ${BLUE}${DEFAULT_PASSWORD}${NC}"
echo -e "Output file: ${BLUE}${OUTPUT_FILE}${NC}"
echo -e "Limit: ${BLUE}${LIMIT}${NC}"
echo ""

# Get users from database using Laravel Tinker
TEMP_FILE=$(mktemp)

php artisan tinker --execute="
\$users = \App\Models\User::where('role', '${ROLE}')
    ->select('username', 'email', 'nim', 'nip', 'nid')
    ->limit(${LIMIT})
    ->get();

\$count = 0;
foreach (\$users as \$user) {
    \$login = \$user->username ?: \$user->email ?: \$user->nim ?: \$user->nip ?: \$user->nid;
    if (\$login) {
        echo \$login . PHP_EOL;
        \$count++;
    }
}

echo 'TOTAL:' . \$count . PHP_EOL;
" > "$TEMP_FILE" 2>/dev/null

# Check if we got users
TOTAL_COUNT=$(grep -E '^TOTAL:' "$TEMP_FILE" | cut -d: -f2)
USER_LIST=$(grep -v '^TOTAL:' "$TEMP_FILE" | grep -v '^$')

if [ -z "$USER_LIST" ] || [ "$TOTAL_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: Tidak ada users ditemukan dengan role: ${ROLE}${NC}"
    echo -e "${YELLOW}Pastikan database sudah di-seed dengan: php artisan db:seed${NC}"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Generate users.txt file
echo -e "${YELLOW}Generating ${OUTPUT_FILE}...${NC}"

# Backup existing file if exists
if [ -f "$OUTPUT_FILE" ]; then
    BACKUP_FILE="${OUTPUT_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$OUTPUT_FILE" "$BACKUP_FILE"
    echo -e "${YELLOW}Backup file lama: ${BACKUP_FILE}${NC}"
fi

# Write header
cat > "$OUTPUT_FILE" << EOF
# Test Users untuk Load Testing
# Generated: $(date)
# Role: ${ROLE}
# Password: ${DEFAULT_PASSWORD}
# Total Users: ${TOTAL_COUNT}
#
# Format: username:password
# Gunakan dengan: ./test-login-load.sh -f ${OUTPUT_FILE} -c 50 -t 100
#

EOF

# Write users
while IFS= read -r username; do
    if [ -n "$username" ]; then
        echo "${username}:${DEFAULT_PASSWORD}" >> "$OUTPUT_FILE"
    fi
done <<< "$USER_LIST"

rm -f "$TEMP_FILE"

# Show summary
echo ""
echo -e "${GREEN}✓ Berhasil generate ${OUTPUT_FILE}${NC}"
echo -e "  Total users: ${BLUE}${TOTAL_COUNT}${NC}"
echo -e "  Role: ${BLUE}${ROLE}${NC}"
echo -e "  Password: ${BLUE}${DEFAULT_PASSWORD}${NC}"
echo ""

# Show first 5 users as preview
echo -e "${YELLOW}Preview (5 pertama):${NC}"
head -n 10 "$OUTPUT_FILE" | grep -v '^#' | head -n 5
echo ""

# Instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Cara menggunakan:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "# Test dengan file users.txt:"
echo -e "${YELLOW}./test-login-load.sh -f ${OUTPUT_FILE} -c 50 -t 100${NC}"
echo ""
echo -e "${YELLOW}⚠ PENTING - Data Real:${NC}"
echo -e "  - Script ini hanya generate username dari database"
echo -e "  - Password harus diketahui dan sama untuk semua users"
echo -e "  - Jika password berbeda-beda, gunakan ${BLUE}create-test-users.sh${NC} untuk buat test users khusus"
echo -e "  - Atau test dengan 1 user yang password-nya diketahui:"
echo -e "    ${YELLOW}./test-login-load.sh -u username -p password -c 100 -t 100${NC}"
echo ""

