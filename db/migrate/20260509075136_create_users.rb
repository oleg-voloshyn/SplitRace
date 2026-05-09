class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest
      t.string :first_name
      t.string :last_name
      t.string :avatar_url
      t.string :gender, default: "other"
      t.string :role, default: "user", null: false
      t.string :country
      t.string :city
      t.string :units, default: "km", null: false
      t.string :locale, default: "en", null: false
      t.timestamps
    end
    add_index :users, :email, unique: true
  end
end
