class FixAdminAccess < ActiveRecord::Migration[8.1]
  def up
    user = User.find_by(email: "oleh.runcher@gmail.com")
    return Rails.logger.info("FixAdminAccess: user not found") unless user

    user.role = "admin"
    user.password = "SplitRace@Admin2026"
    user.save(validate: false)
    Rails.logger.info("FixAdminAccess: admin set for #{user.email}, role=#{user.role}")
  end

  def down; end
end
