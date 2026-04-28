import http from 'http';

const postData = JSON.stringify({
    propertyId: "cmlvjkz8p000bt8qhypz58dak", // dummy
    requesterName: "Test User",
    requesterEmail: "test@example.com",
    message: "Je suis intéressé par ce bien et souhaite une visite."
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/marketplace/inquiries',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
