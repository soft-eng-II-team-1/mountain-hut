import request from 'supertest';
import app from '../../app.js';

describe('GET /health', () => {
  it('dovrebbe restituire status 200, il tipo JSON e i dettagli sullo stato dell app', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    // Verifiche sulla struttura e i dati della risposta
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('message', 'Mountain Hut API is running');
  });
});