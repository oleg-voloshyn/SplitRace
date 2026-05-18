class RecalculateTournamentScoresForFirstOpenerBonus < ActiveRecord::Migration[8.1]
  def up
    say_with_time 'Recalculating tournament scores with first opener bonus' do
      Tournament.where(status: %w[active completed]).find_each do |tournament|
        TournamentScore.recalculate_all(tournament)
      end
    end
  end

  def down
    say 'Scores are not reverted because they are derived from segment efforts.'
  end
end
