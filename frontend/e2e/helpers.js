import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../..');
const rbenvShims = path.join(process.env.HOME || '', '.rbenv/shims');
const password = 'password123';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function runRails(script) {
  return execFileSync('bin/rails', ['runner', '-e', 'test', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${rbenvShims}:${process.env.PATH}`, RAILS_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function railsJson(script) {
  const output = runRails(script);
  return JSON.parse(output.split('\n').at(-1));
}

function seedAdminCatalog(prefix) {
  const rubyPrefix = JSON.stringify(prefix);
  const rubyPassword = JSON.stringify(password);

  return railsJson(`
    require "json"

    prefix = ${rubyPrefix}
    password = ${rubyPassword}
    factory = RGeo::Geographic.spherical_factory(srid: 4326)

    def ensure_user(email:, password:, role: "user", first_name: nil, gender: "other")
      user = User.find_or_initialize_by(email: email)
      user.password = password
      user.password_confirmation = password
      user.role = role
      user.first_name = first_name
      user.gender = gender
      user.save!
      user
    end

    def geometry(factory, start_lng, start_lat, end_lng, end_lat)
      points = [factory.point(start_lng, start_lat), factory.point(end_lng, end_lat)]
      {
        start_point: points.first,
        end_point: points.last,
        polyline: factory.multi_line_string([factory.line_string(points)]),
        distance_meters: 1500
      }
    end

    admin = ensure_user(email: "\#{prefix}-admin@example.com", password: password, role: "admin", first_name: "E2E Admin")
    owner = ensure_user(email: "\#{prefix}-owner@example.com", password: password, first_name: "E2E Owner")

    alpha_segment = Segment.find_or_initialize_by(name: "\#{prefix} Alpha Segment")
    alpha_segment.assign_attributes(
      created_by: owner,
      is_active: true,
      city: "Kyiv",
      country: "UA",
      **geometry(factory, 30.52, 50.45, 30.53, 50.46)
    )
    alpha_segment.save!

    beta_segment = Segment.find_or_initialize_by(name: "\#{prefix} Beta Segment")
    beta_segment.assign_attributes(
      created_by: owner,
      is_active: true,
      city: "Lviv",
      country: "UA",
      **geometry(factory, 24.03, 49.84, 24.04, 49.85)
    )
    beta_segment.save!

    tournament = Tournament.find_or_initialize_by(name: "\#{prefix} Alpha Tournament")
    tournament.assign_attributes(
      description: "Playwright smoke tournament",
      created_by: owner,
      total_segments_count: 2,
      rated_segments_count: 1,
      city: "Kyiv",
      country: "UA",
      status: "pending_review"
    )
    tournament.save!

    active_tournament = Tournament.find_or_initialize_by(name: "\#{prefix} Active Tournament")
    active_tournament.assign_attributes(
      description: "Visible Playwright tournament",
      created_by: owner,
      total_segments_count: 2,
      rated_segments_count: 1,
      city: "Kyiv",
      country: "UA",
      status: "active"
    )
    active_tournament.save!

    unless active_tournament.tournament_segments.exists?(segment: alpha_segment)
      active_tournament.tournament_segments.create!(segment: alpha_segment, order_number: 1, is_rated: true)
    end

    puts JSON.dump({
      admin_email: admin.email,
      password: password,
      tournament_name: tournament.name,
      active_tournament_name: active_tournament.name,
      active_tournament_slug: active_tournament.slug,
      segment_name: alpha_segment.name
    })
  `);
}

async function registerViaApi(request, page, overrides = {}) {
  const email = overrides.email || uniqueEmail('e2e-runner');
  const response = await request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      password_confirmation: password,
      first_name: 'E2E',
      last_name: 'Runner',
      gender: 'other',
      ...overrides
    }
  });

  if (!response.ok()) {
    throw new Error(`Registration failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  await page.addInitScript((token) => {
    globalThis.localStorage.setItem('splitrace_token', token);
  }, body.token);

  return { ...body, email, password };
}

async function mockMapNetwork(page) {
  await page.route('https://nominatim.openstreetmap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ address: { city: 'Kyiv', country_code: 'ua' } })
    });
  });

  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

export { mockMapNetwork, password, registerViaApi, seedAdminCatalog, uniqueEmail };
