class SetDefaultScoringTypeToGoldenFever < ActiveRecord::Migration[8.1]
  def up
    change_column_default :tournaments, :scoring_type, from: nil, to: "golden_fever"
    Tournament.update_all(scoring_type: "golden_fever")
  end

  def down
    change_column_default :tournaments, :scoring_type, from: "golden_fever", to: nil
  end
end
