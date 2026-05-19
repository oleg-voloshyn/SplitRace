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
    joined_at = 30.minutes.ago
    tournament.tournament_participants.create!(user: first_runner, joined_at:)
    tournament.tournament_participants.create!(user: second_runner, joined_at:)

    first_runner_first = create_effort(user: first_runner, segment: first_segment, elapsed: 120, started_at: 20.minutes.ago)
    first_runner_second = create_effort(user: first_runner, segment: second_segment, elapsed: 180, started_at: 18.minutes.ago)
    second_runner_first = create_effort(user: second_runner, segment: first_segment, elapsed: 120, started_at: 10.minutes.ago)
    second_runner_second = create_effort(user: second_runner, segment: second_segment, elapsed: 180, started_at: 8.minutes.ago)
    create_unlock_event(tournament:, effort: first_runner_first)
    create_unlock_event(tournament:, effort: first_runner_second)
    create_unlock_event(tournament:, effort: second_runner_first)
    create_unlock_event(tournament:, effort: second_runner_second)

    TournamentScore.recalculate_all(tournament)

    assert_equal 220.0, TournamentScore.find_by!(tournament:, user: first_runner).score
    assert_equal 200.0, TournamentScore.find_by!(tournament:, user: second_runner).score
  end

  test 'golden fever ignores efforts before tournament start and efforts without tournament unlock event' do
    owner = create_user(email: 'score-window-owner@example.com')
    runner = create_user(email: 'score-window-runner@example.com')
    starts_at = Time.zone.at(2_000)
    tournament = create_tournament(owner, total_segments_count: 2, rated_segments_count: 1, starts_at:)
    segment = create_segment(owner, name: 'Window Segment', lng_offset: 0.004)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_900))

    before_start_effort = create_effort(user: runner, segment:, elapsed: 100, started_at: Time.zone.at(1_950))
    create_unlock_event(tournament:, effort: before_start_effort)
    create_effort(user: runner, segment:, elapsed: 90, started_at: Time.zone.at(2_100))

    TournamentScore.recalculate_all(tournament)

    score = TournamentScore.find_by!(tournament:, user: runner)
    assert_equal 0, score.completed_segments_count
    assert_equal 0.0, score.score

    valid_effort = create_effort(user: runner, segment:, elapsed: 80, started_at: Time.zone.at(2_200))
    create_unlock_event(tournament:, effort: valid_effort)

    TournamentScore.recalculate_all(tournament)

    score.reload
    assert_equal 1, score.completed_segments_count
    assert_operator score.score, :>, 0
  end

  test 'golden fever ignores efforts before runner joined an already started tournament' do
    owner = create_user(email: 'score-join-owner@example.com')
    runner = create_user(email: 'score-join-runner@example.com')
    tournament = create_tournament(owner, total_segments_count: 2, rated_segments_count: 1, starts_at: Time.zone.at(1_000))
    segment = create_segment(owner, name: 'Join Window Segment', lng_offset: 0.005)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(2_000))

    before_join_effort = create_effort(user: runner, segment:, elapsed: 100, started_at: Time.zone.at(1_500))
    create_unlock_event(tournament:, effort: before_join_effort)

    TournamentScore.recalculate_all(tournament)

    assert_equal 0, TournamentScore.find_by!(tournament:, user: runner).completed_segments_count

    valid_effort = create_effort(user: runner, segment:, elapsed: 100, started_at: Time.zone.at(2_100))
    create_unlock_event(tournament:, effort: valid_effort)

    TournamentScore.recalculate_all(tournament)

    assert_equal 1, TournamentScore.find_by!(tournament:, user: runner).completed_segments_count
  end

  test 'golden fever ignores efforts at or after tournament end' do
    owner = create_user(email: 'score-end-owner@example.com')
    runner = create_user(email: 'score-end-runner@example.com')
    tournament = create_tournament(
      owner,
      total_segments_count: 2,
      rated_segments_count: 1,
      starts_at: Time.zone.at(1_000),
      ends_at: Time.zone.at(2_000)
    )
    segment = create_segment(owner, name: 'End Window Segment', lng_offset: 0.006)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(900))

    after_end_effort = create_effort(user: runner, segment:, elapsed: 100, started_at: Time.zone.at(2_000))
    create_unlock_event(tournament:, effort: after_end_effort)

    TournamentScore.recalculate_all(tournament)

    assert_equal 0, TournamentScore.find_by!(tournament:, user: runner).completed_segments_count

    before_end_effort = create_effort(user: runner, segment:, elapsed: 100, started_at: Time.zone.at(1_999))
    create_unlock_event(tournament:, effort: before_end_effort)

    TournamentScore.recalculate_all(tournament)

    assert_equal 1, TournamentScore.find_by!(tournament:, user: runner).completed_segments_count
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

  def create_tournament(owner, total_segments_count:, rated_segments_count:, starts_at: nil, ends_at: nil)
    Tournament.create!(
      name: "Score Cup #{SecureRandom.hex(4)}",
      created_by: owner,
      status: 'active',
      city: 'Kyiv',
      country: 'UA',
      total_segments_count:,
      rated_segments_count:,
      starts_at:,
      ends_at:
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

  def create_unlock_event(tournament:, effort:)
    TournamentEventPublisher.segment_unlocked!(tournament:, segment_effort: effort)
  end
end
