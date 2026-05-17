class AddPassedSegmentIdsToActivities < ActiveRecord::Migration[8.1]
  def change
    add_column :activities, :passed_segment_ids, :integer, array: true, default: []
  end
end
