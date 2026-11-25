<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_successfully(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'Ahmad Santoso',
            'email' => 'ahmad@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Registrasi berhasil.',
            ])
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email'],
                    'token',
                ],
            ]);

        $this->assertDatabaseHas('users', ['email' => 'ahmad@example.com']);
        $this->assertDatabaseHas('accounts', ['name' => 'Rekening Utama']);
        $this->assertDatabaseHas('self_lock_settings', ['is_active' => false]);
    }

    public function test_user_cannot_register_with_duplicate_email(): void
    {
        User::factory()->create(['email' => 'ahmad@example.com']);

        $response = $this->postJson('/api/v1/register', [
            'name' => 'Ahmad Santoso',
            'email' => 'ahmad@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'budi@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/login', [
            'email' => 'budi@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login berhasil.',
            ])
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email'],
                    'token',
                ],
            ]);
    }

    public function test_user_cannot_login_with_invalid_password(): void
    {
        User::factory()->create([
            'email' => 'budi@example.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/login', [
            'email' => 'budi@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->get('/api/v1/budgets');

        $response->assertStatus(401)
            ->assertHeader('content-type', 'application/json')
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_invalid_bearer_token_is_rejected_with_json(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer invalid-token')
            ->get('/api/v1/budgets');

        $response->assertStatus(401)
            ->assertHeader('content-type', 'application/json')
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_login_token_authenticates_protected_api_requests(): void
    {
        User::factory()->create([
            'email' => 'budi@example.com',
            'password' => bcrypt('password123'),
        ]);

        $login = $this->postJson('/api/v1/login', [
            'email' => 'budi@example.com',
            'password' => 'password123',
        ]);

        $login->assertOk()
            ->assertJsonStructure(['data' => ['token']]);

        $token = $login->json('data.token');

        $this->withToken($token)
            ->getJson('/api/v1/user')
            ->assertOk()
            ->assertJsonPath('data.email', 'budi@example.com');
    }

    public function test_logout_invalidates_the_current_bearer_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/logout')
            ->assertOk()
            ->assertJson(['success' => true, 'message' => 'Logout berhasil.']);

        $this->assertDatabaseCount('personal_access_tokens', 0);

        Auth::forgetGuards();

        $this->withToken($token)
            ->get('/api/v1/user')
            ->assertStatus(401)
            ->assertHeader('content-type', 'application/json')
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_missing_resource_returns_json_not_found(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($token)
            ->get('/api/v1/accounts/999999')
            ->assertNotFound()
            ->assertHeader('content-type', 'application/json')
            ->assertJsonStructure(['message']);
    }

    public function test_cors_allows_the_deployed_frontend_to_send_bearer_tokens(): void
    {
        $response = $this->call('OPTIONS', '/api/v1/user', server: [
            'HTTP_ORIGIN' => 'https://saku-pas.vercel.app',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization,content-type',
        ]);

        $response->assertNoContent()
            ->assertHeader('access-control-allow-origin', 'https://saku-pas.vercel.app');

        $this->assertStringContainsStringIgnoringCase(
            'authorization',
            (string) $response->headers->get('access-control-allow-headers'),
        );
        $this->assertStringContainsStringIgnoringCase(
            'content-type',
            (string) $response->headers->get('access-control-allow-headers'),
        );

        $blocked = $this->call('OPTIONS', '/api/v1/user', server: [
            'HTTP_ORIGIN' => 'https://untrusted.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);

        $this->assertNotSame(
            'https://untrusted.example',
            $blocked->headers->get('access-control-allow-origin'),
        );
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/user');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ]);
    }
}
