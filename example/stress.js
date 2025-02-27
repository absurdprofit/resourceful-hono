import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

export const options = {
  scenarios: {
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '10s', target: 200 },
        { duration: '10s', target: 400 },
        { duration: '10s', target: 800 },
        { duration: '10s', target: 1600 },
        { duration: '10s', target: 3200 },
        { duration: '30s', target: 6400 },
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'], // Stop if failure rate exceeds 2%
    http_req_duration: ['p(95)<200'], // Stop if 95% of requests exceed 200ms
  },
};

export default function () {
  const baseURL = "http://localhost:8000/api/v1/json";

  // GET Request
  const getResponse = http.get(`${baseURL}/9491d710-3185-4e06-bea0-6a2f275345e0/nathan?page=10`);
  check(getResponse, {
    'GET request successful': (res) => res.status === 200,
  });

  // PUT Request
  const putResponse = http.put(baseURL, JSON.stringify({
    name: "Nathan Johnson",
    displayName: "absurdprofit",
    email: "nahtanjohn1l@gmail.com"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  check(putResponse, {
    'PUT request successful': (res) => res.status === 201,
  });

  // POST Request
  const postResponse = http.post(baseURL, "1", {
    headers: { 'Content-Type': 'text/plain' }
  });
  check(postResponse, {
    'POST request successful': (res) => res.status === 200,
  });

  // DELETE Request
  const fd = new FormData();
  fd.append('name', "Nathan Johnson");
  fd.append('displayName', "absurdprofit");
  fd.append('email', "nahtanjohn1l@gmail.com");
  fd.append('page', "10");
  const deleteResponse = http.del(baseURL, fd.body(), {
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + fd.boundary }
  });
  check(deleteResponse, {
    'DELETE request successful': (res) => res.status === 201,
  });

  sleep(0.1); // Short pause between requests
}
