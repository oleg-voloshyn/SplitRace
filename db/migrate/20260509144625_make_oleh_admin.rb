class MakeOlehAdmin < ActiveRecord::Migration[8.1]
  def up
    User.find_by(email: "oleh.runcher@gmail.com")&.update_column(:role, "admin")
  end

  def down
    User.find_by(email: "oleh.runcher@gmail.com")&.update_column(:role, "user")
  end
end
