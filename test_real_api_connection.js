#!/usr/bin/env node

/**
 * Simple test script to verify the frontend can connect to the real backend API
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api/v1';

async function testApiConnection() {
    console.log('🔍 Testing connection to real backend API...');
    console.log(`   API URL: ${API_BASE_URL}`);
    
    try {
        // Test basic API connectivity (using a working endpoint)
        const response = await axios.get(`${API_BASE_URL}/recipes`, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Backend API is responding!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Backend API is not running!');
            console.log('   Please start the backend server first:');
            console.log('   1. cd /mnt/data/WORK/Jidelnicek_2.0');
            console.log('   2. python -m uvicorn src.jidelnicek.main:app --reload --host 0.0.0.0 --port 8000');
        } else if (error.response) {
            console.log(`⚠️  API responded with error: ${error.response.status}`);
            console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.log(`❌ Connection error: ${error.message}`);
        }
    }
}

async function testRegisterEndpoint() {
    console.log('\n📝 Testing user registration endpoint...');
    
    try {
        const testUser = {
            email: 'test-' + Date.now() + '@example.com',
            password: 'TestPassword9#8@',
            confirm_password: 'TestPassword9#8@',
            language: 'en',
            unit_system: 'metric',
            energy_unit: 'kcal'
        };
        
        const response = await axios.post(`${API_BASE_URL}/auth/register`, testUser, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Registration endpoint is working!');
        console.log(`   Status: ${response.status}`);
        console.log(`   User created: ${testUser.email}`);
        console.log(`   Response includes:`);
        console.log(`   - Access token: ${response.data.access_token ? 'YES' : 'NO'}`);
        console.log(`   - Refresh token: ${response.data.refresh_token ? 'YES' : 'NO'}`);
        console.log(`   - User data: ${response.data.user ? 'YES' : 'NO'}`);
        console.log(`   - Token type: ${response.data.token_type || 'NOT PROVIDED'}`);
        console.log(`   - Expires in: ${response.data.expires_in || 'NOT PROVIDED'} seconds`);
        
    } catch (error) {
        if (error.response) {
            console.log(`⚠️  Registration failed: ${error.response.status}`);
            console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.log(`❌ Registration error: ${error.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Real API Connection Test\n');
    
    await testApiConnection();
    await testRegisterEndpoint();
    
    console.log('\n📋 Summary:');
    console.log('   Mock auth is now DISABLED in frontend');
    console.log('   Frontend will use real backend API for authentication');
    console.log('   You can now register and login with real user accounts');
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure backend is running on http://localhost:8000');
    console.log('   2. Go to http://localhost:3000/auth/register');
    console.log('   3. Create a new user account');
    console.log('   4. Login with your real credentials');
}

if (require.main === module) {
    main().catch(console.error);
}