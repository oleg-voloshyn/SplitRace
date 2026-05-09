class SetAdminPassword < ActiveRecord::Migration[8.1]
  def up
    user = User.find_by(email: "oleh.runcher@gmail.com")
    user&.update_column(:password_digest, BCrypt::Password.create("SplitRace@Admin2026"))
  end

  def down; end
end
