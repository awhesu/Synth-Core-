#!/bin/bash
# Quick test script to verify Syntherium services

echo "🧪 Testing Syntherium Services..."
echo ""

# Test each service health endpoint
services=(
    "3000:api-gateway"
    "3001:intent-service"
    "3002:webhook-service"
    "3003:settlement-service"
    "3004:ledger-service"
    "3005:orders-service"
    "3006:ops-service"
)

for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/v1/health" 2>/dev/null)
    
    if [ "$response" == "200" ]; then
        echo "✅ ${name} (port ${port}) - OK"
    else
        echo "❌ ${name} (port ${port}) - Not responding (HTTP ${response})"
    fi
done

echo ""
echo "🔍 Testing Database Connection..."
# Test database by checking if seed accounts exist
response=$(curl -s "http://localhost:3004/v1/wallets/PLATFORM_ESCROW/balance" 2>/dev/null)
if echo "$response" | grep -q "accountId"; then
    echo "✅ Database connection - OK"
    echo "   PLATFORM_ESCROW balance: $(echo $response | grep -o '"balance":"[^"]*"')"
else
    echo "❌ Database connection - Failed"
fi

echo ""
echo "📋 Quick API Test - Create Order..."
order_response=$(curl -s -X POST "http://localhost:3005/v1/orders" \
    -H "Content-Type: application/json" \
    -d '{
        "customerId": "test_customer_1",
        "vendorId": "test_vendor_1",
        "items": [{"productId": "lpg_12kg", "productName": "12kg LPG Refill", "quantity": 1, "unitPrice": "5000.0000"}],
        "deliveryType": "DELIVERY"
    }' 2>/dev/null)

if echo "$order_response" | grep -q '"id"'; then
    order_id=$(echo $order_response | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "✅ Order created: ${order_id}"
else
    echo "❌ Order creation failed"
    echo "   Response: ${order_response}"
fi

echo ""
echo "🎉 Testing complete!"
