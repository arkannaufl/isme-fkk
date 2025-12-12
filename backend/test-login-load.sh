#!/bin/bash

# Script untuk Load Testing Login Endpoint
# Simulate banyak user login bersamaan untuk test kapasitas server

# Colors untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8000/api}"
ENDPOINT="${API_URL}/login"
CONCURRENT_USERS="${CONCURRENT_USERS:-50}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-100}"
DELAY_BETWEEN_BATCHES="${DELAY_BETWEEN_BATCHES:-0.1}"

# Test credentials (default - bisa diubah via parameter)
TEST_USERNAME="${TEST_USERNAME:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

# Statistics
SUCCESS_COUNT=0
FAILED_COUNT=0
RATE_LIMIT_COUNT=0
ALREADY_LOGGED_IN_COUNT=0
INVALID_CREDENTIALS_COUNT=0
OTHER_ERROR_COUNT=0
TOTAL_TIME=0

# Function untuk print header
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Load Testing - Login Endpoint${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "API URL: ${YELLOW}${ENDPOINT}${NC}"
    echo -e "Concurrent Users: ${YELLOW}${CONCURRENT_USERS}${NC}"
    echo -e "Total Requests: ${YELLOW}${TOTAL_REQUESTS}${NC}"
    echo -e "Delay Between Batches: ${YELLOW}${DELAY_BETWEEN_BATCHES}s${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function untuk test single login
test_login() {
    local username=$1
    local password=$2
    local request_num=$3
    
    local start_time=$(date +%s.%N)
    
    # Make request dengan timeout 10 detik
    local response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
        -X POST "${ENDPOINT}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "{\"login\":\"${username}\",\"password\":\"${password}\"}" \
        --max-time 10 \
        2>/dev/null)
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    # Parse response
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local time_total=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -2)
    
    # Check result
    case $http_code in
        200)
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            echo -e "${GREEN}✓${NC} Request #${request_num}: Success (${time_total}s)"
            ;;
        401)
            INVALID_CREDENTIALS_COUNT=$((INVALID_CREDENTIALS_COUNT + 1))
            echo -e "${YELLOW}✗${NC} Request #${request_num}: Invalid credentials (401)"
            ;;
        403)
            ALREADY_LOGGED_IN_COUNT=$((ALREADY_LOGGED_IN_COUNT + 1))
            echo -e "${YELLOW}✗${NC} Request #${request_num}: Already logged in (403)"
            ;;
        429)
            RATE_LIMIT_COUNT=$((RATE_LIMIT_COUNT + 1))
            echo -e "${RED}✗${NC} Request #${request_num}: Rate limited (429)"
            ;;
        000)
            FAILED_COUNT=$((FAILED_COUNT + 1))
            echo -e "${RED}✗${NC} Request #${request_num}: Connection failed/timeout"
            ;;
        *)
            OTHER_ERROR_COUNT=$((OTHER_ERROR_COUNT + 1))
            echo -e "${RED}✗${NC} Request #${request_num}: Error ${http_code}"
            ;;
    esac
    
    TOTAL_TIME=$(echo "$TOTAL_TIME + $time_total" | bc)
}

# Function untuk get users dari database (jika Laravel Tinker tersedia)
get_users_from_db() {
    local role=${1:-mahasiswa}
    
    # Try to get users from database using Laravel Tinker
    if command -v php &> /dev/null; then
        cd "$(dirname "$0")" || exit 1
        
        # Get users dengan role tertentu
        php artisan tinker --execute="
            \$users = \App\Models\User::where('role', '${role}')
                ->select('username', 'email', 'nim', 'nip', 'nid')
                ->limit(100)
                ->get()
                ->map(function(\$u) {
                    return [
                        'login' => \$u->username ?: \$u->email ?: \$u->nim ?: \$u->nip ?: \$u->nid,
                    ];
                })
                ->toJson();
            echo \$users;
        " 2>/dev/null | grep -E '^\[|^\{' | jq -r '.[].login' 2>/dev/null || echo ""
    fi
}

# Function untuk print summary
print_summary() {
    local total_attempted=$((SUCCESS_COUNT + FAILED_COUNT + RATE_LIMIT_COUNT + ALREADY_LOGGED_IN_COUNT + INVALID_CREDENTIALS_COUNT + OTHER_ERROR_COUNT))
    local success_rate=0
    local avg_time=0
    
    if [ $total_attempted -gt 0 ]; then
        success_rate=$(echo "scale=2; ($SUCCESS_COUNT * 100) / $total_attempted" | bc)
        avg_time=$(echo "scale=3; $TOTAL_TIME / $total_attempted" | bc)
    fi
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}           TEST SUMMARY${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Total Requests: ${YELLOW}${total_attempted}${NC}"
    echo -e "${GREEN}✓ Success: ${SUCCESS_COUNT}${NC}"
    echo -e "${RED}✗ Failed: ${FAILED_COUNT}${NC}"
    echo -e "${YELLOW}⚠ Rate Limited: ${RATE_LIMIT_COUNT}${NC}"
    echo -e "${YELLOW}⚠ Already Logged In: ${ALREADY_LOGGED_IN_COUNT}${NC}"
    echo -e "${YELLOW}⚠ Invalid Credentials: ${INVALID_CREDENTIALS_COUNT}${NC}"
    echo -e "${RED}✗ Other Errors: ${OTHER_ERROR_COUNT}${NC}"
    echo ""
    echo -e "Success Rate: ${GREEN}${success_rate}%${NC}"
    echo -e "Average Response Time: ${YELLOW}${avg_time}s${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function untuk help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --username USERNAME    Username untuk test (required jika tidak pakai --users-file)"
    echo "  -p, --password PASSWORD    Password untuk test (required jika tidak pakai --users-file)"
    echo "  -c, --concurrent NUM       Jumlah concurrent users (default: 50)"
    echo "  -t, --total NUM            Total requests (default: 100)"
    echo "  -d, --delay SECONDS        Delay antara batches (default: 0.1)"
    echo "  -a, --api-url URL          API base URL (default: http://localhost:8000/api)"
    echo "  -f, --users-file FILE      File berisi list username:password (satu per baris)"
    echo "  -r, --role ROLE            Get users dari database dengan role tertentu (mahasiswa/dosen)"
    echo "  -h, --help                 Show this help"
    echo ""
    echo "Examples:"
    echo "  # Test dengan 1 user, 100 concurrent requests"
    echo "  $0 -u testuser -p password123 -c 100 -t 100"
    echo ""
    echo "  # Test dengan 50 concurrent users, 200 total requests"
    echo "  $0 -u testuser -p password123 -c 50 -t 200"
    echo ""
    echo "  # Test dengan users dari database (role mahasiswa)"
    echo "  $0 -r mahasiswa -c 50 -t 100"
    echo ""
    echo "  # Test dengan users dari file"
    echo "  $0 -f users.txt -c 50 -t 100"
    echo ""
}

# Parse arguments
USERS_FILE=""
ROLE=""
USE_DB_USERS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--username)
            TEST_USERNAME="$2"
            shift 2
            ;;
        -p|--password)
            TEST_PASSWORD="$2"
            shift 2
            ;;
        -c|--concurrent)
            CONCURRENT_USERS="$2"
            shift 2
            ;;
        -t|--total)
            TOTAL_REQUESTS="$2"
            shift 2
            ;;
        -d|--delay)
            DELAY_BETWEEN_BATCHES="$2"
            shift 2
            ;;
        -a|--api-url)
            API_URL="$2"
            ENDPOINT="${API_URL}/login"
            shift 2
            ;;
        -f|--users-file)
            USERS_FILE="$2"
            shift 2
            ;;
        -r|--role)
            ROLE="$2"
            USE_DB_USERS=true
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

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

if ! command -v bc &> /dev/null; then
    echo -e "${RED}Error: bc is not installed. Install with: sudo apt-get install bc${NC}"
    exit 1
fi

# Validate credentials
if [ -z "$USERS_FILE" ] && [ "$USE_DB_USERS" = false ]; then
    if [ -z "$TEST_USERNAME" ] || [ -z "$TEST_PASSWORD" ]; then
        echo -e "${RED}Error: Username and password required (use -u and -p)${NC}"
        echo "Or use --users-file or --role option"
        show_help
        exit 1
    fi
fi

# Get users list
declare -a USER_CREDENTIALS

if [ -n "$USERS_FILE" ]; then
    # Read from file
    if [ ! -f "$USERS_FILE" ]; then
        echo -e "${RED}Error: Users file not found: ${USERS_FILE}${NC}"
        exit 1
    fi
    
    while IFS=: read -r username password; do
        if [ -n "$username" ] && [ -n "$password" ]; then
            USER_CREDENTIALS+=("${username}:${password}")
        fi
    done < "$USERS_FILE"
    
    if [ ${#USER_CREDENTIALS[@]} -eq 0 ]; then
        echo -e "${RED}Error: No valid credentials found in file${NC}"
        exit 1
    fi
elif [ "$USE_DB_USERS" = true ]; then
    # Get from database
    echo -e "${YELLOW}Fetching users from database...${NC}"
    cd "$(dirname "$0")" || exit 1
    
    # Default password (bisa diubah via environment variable)
    DB_PASSWORD="${DB_PASSWORD:-password}"
    
    # Get users and create temp file
    TEMP_FILE=$(mktemp)
    php artisan tinker --execute="
        \$users = \App\Models\User::where('role', '${ROLE}')
            ->select('username', 'email', 'nim', 'nip', 'nid')
            ->limit(100)
            ->get();
        foreach (\$users as \$user) {
            \$login = \$user->username ?: \$user->email ?: \$user->nim ?: \$user->nip ?: \$user->nid;
            if (\$login) {
                echo \$login . ':' . '${DB_PASSWORD}' . PHP_EOL;
            }
        }
    " > "$TEMP_FILE" 2>/dev/null
    
    while IFS=: read -r username password; do
        if [ -n "$username" ] && [ -n "$password" ]; then
            USER_CREDENTIALS+=("${username}:${password}")
        fi
    done < "$TEMP_FILE"
    rm -f "$TEMP_FILE"
    
    if [ ${#USER_CREDENTIALS[@]} -eq 0 ]; then
        echo -e "${RED}Error: No users found in database with role: ${ROLE}${NC}"
        echo -e "${YELLOW}Note: Using default password 'password123'. Make sure users have this password or update script.${NC}"
        exit 1
    fi
else
    # Single user
    USER_CREDENTIALS+=("${TEST_USERNAME}:${TEST_PASSWORD}")
fi

# Print header
print_header

# Start testing
echo -e "${YELLOW}Starting load test...${NC}"
echo ""

START_TIME=$(date +%s)

# Calculate batches
BATCHES=$(( (TOTAL_REQUESTS + CONCURRENT_USERS - 1) / CONCURRENT_USERS ))

for ((batch=1; batch<=BATCHES; batch++)); do
    BATCH_START=$(( (batch - 1) * CONCURRENT_USERS + 1 ))
    BATCH_END=$(( batch * CONCURRENT_USERS ))
    
    if [ $BATCH_END -gt $TOTAL_REQUESTS ]; then
        BATCH_END=$TOTAL_REQUESTS
    fi
    
    echo -e "${BLUE}Batch ${batch}/${BATCHES} (Requests ${BATCH_START}-${BATCH_END})${NC}"
    
    # Run concurrent requests
    PIDS=()
    for ((i=BATCH_START; i<=BATCH_END; i++)); do
        # Get random user from credentials array
        CRED_INDEX=$(( (i - 1) % ${#USER_CREDENTIALS[@]} ))
        CRED="${USER_CREDENTIALS[$CRED_INDEX]}"
        USERNAME=$(echo "$CRED" | cut -d: -f1)
        PASSWORD=$(echo "$CRED" | cut -d: -f2)
        
        # Run test in background
        test_login "$USERNAME" "$PASSWORD" "$i" &
        PIDS+=($!)
    done
    
    # Wait for all requests in batch to complete
    for pid in "${PIDS[@]}"; do
        wait $pid
    done
    
    # Delay between batches
    if [ $batch -lt $BATCHES ] && [ "$DELAY_BETWEEN_BATCHES" != "0" ]; then
        sleep "$DELAY_BETWEEN_BATCHES"
    fi
done

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Print summary
print_summary
echo -e "Total Duration: ${YELLOW}${TOTAL_DURATION}s${NC}"
echo ""

# Recommendations
if [ $RATE_LIMIT_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠ Warning: ${RATE_LIMIT_COUNT} requests were rate limited${NC}"
    echo -e "   Consider adjusting rate limiting in routes/api.php"
fi

if [ $FAILED_COUNT -gt $((TOTAL_REQUESTS / 10)) ]; then
    echo -e "${RED}⚠ Warning: High failure rate detected${NC}"
    echo -e "   Check server logs and resource usage"
fi

if [ $SUCCESS_COUNT -lt $((TOTAL_REQUESTS / 2)) ]; then
    echo -e "${RED}⚠ Warning: Low success rate (${SUCCESS_COUNT}/${TOTAL_REQUESTS})${NC}"
    echo -e "   Server may be overloaded. Check:"
    echo -e "   - PHP-FPM processes: sudo systemctl status php8.4-fpm"
    echo -e "   - MySQL connections: mysql -e 'SHOW PROCESSLIST;'"
    echo -e "   - Redis connections: redis-cli CLIENT LIST"
    echo -e "   - System resources: htop"
fi

echo ""

