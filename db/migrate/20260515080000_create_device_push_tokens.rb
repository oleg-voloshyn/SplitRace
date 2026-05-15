class CreateDevicePushTokens < ActiveRecord::Migration[8.1]
  def change
    create_table :device_push_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.string :token, null: false
      t.string :platform, null: false
      t.datetime :last_registered_at, null: false
      t.datetime :disabled_at

      t.timestamps
    end

    add_index :device_push_tokens, :token, unique: true
    add_index :device_push_tokens, %i[user_id disabled_at]
  end
end
