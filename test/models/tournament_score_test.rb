require 'test_helper'

class TournamentScoreTest < ActiveSupport::TestCase
  test 'golden fever adds ten points per rated segment first opened by runner' do
    owner = create_user(email: 'score-owner@example.com')
    first_runner = create_user(email: 'score-first@example.com')
    second_runner = create_user(email: 'score-second@example.com')
    tournament = create_tournament(owner, total_segments_count: 4, rated_segments_count: 3)
    first_segment = create_segment(owner, name: 'First Bonus Segment', lng_offset: 0.001)
    second_segment = create_segment(owner, name: 'Second Bonus Segment', lng_offset: 0.002)
    unopened_segment = create_segment(owner, name: 'Unopened Segment', lng_offset: 0.003)

    tournament.tournament_segments.create!(segment: first_segment, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second_segment, order_number: 2, is_rated: true)
    tournament.tournament_segments.create!(segment: unopened_segment, order_number: 3, is_rated: true)
    tournament.tournament_participants.create!(user: first_runner)
    tournament.tournament_participants.create!(user: second_runner)

    create_effort(user: first_runner, segment: first_segment, elapsed: 120, started_at: 20.minutes.ago)
    create_effort(user: first_runner, segment: second_segment, elapsed: 180, started_at: 18.minutes.ago)
    create_effort(user: second_runner, segment: first_segment, elapsed: 120, started_at: 10.minutes.ago)
    create_effort(user: second_runner, segment: second_segment, elapsed: 180, started_at: 8.minutes.ago)

    TournamentScore.recalculate_all(tournament)

    assert_equal 220.0, TournamentScore.find_by!(tournament:, user: first_runner).score
    assert_equal 200.0, TournamentScore.find_by!(tournament:, user: second_runner).score
  end

  private

  def create_user(email:)
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      gender: 'other'
    )
  end

  def create_tournament(owner, total_segments_count:, rated_segments_count:)
    Tournament.create!(
      name: "Score Cup #{SecureRandom.hex(4)}",
      created_by: owner,
      status: 'active',
      city: 'Kyiv',
      country: 'UA',
      total_segments_count:,
      rated_segments_count:
    )
  end

  def create_segment(owner, name:, lng_offset:)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    start_point = factory.point(30.52 + lng_offset, 50.45)
    end_point = factory.point(30.53 + lng_offset, 50.46)
    Segment.create!(
      name:,
      created_by: owner,
      is_active: true,
      city: 'Kyiv',
      country: 'UA',
      start_point:,
      end_point:,
      polyline: factory.multi_line_string([factory.line_string([start_point, end_point])]),
      distance_meters: 1_500
    )
  end

  def create_effort(user:, segment:, elapsed:, started_at:)
    activity = user.activities.create!(
      started_at: started_at - 1.minute,
      finished_at: started_at + elapsed.seconds,
      distance_meters: 1_500,
      elapsed_time_seconds: elapsed,
      source: 'mobile_android'
    )
    SegmentEffort.create!(
      user:,
      segment:,
      activity:,
      elapsed_time_seconds: elapsed,
      started_at:
    )
  end
end
