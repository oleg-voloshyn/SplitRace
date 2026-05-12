class Admin::CheatingReportsController < Admin::BaseController
  def index
    @reports = CheatingReport.for_admin
    @reports = @reports.where(status: params[:status]) if params[:status].present?
  end

  def show
    @report = CheatingReport.includes(:reporter, :reported_user, :tournament).find(params[:id])
  end

  def update
    @report = CheatingReport.find(params[:id])
    new_status = params[:status]
    notes = params[:admin_notes]

    unless %w[dismissed upheld].include?(new_status)
      redirect_to admin_cheating_report_path(@report), alert: "Invalid action."
      return
    end

    @report.mark_reviewed!(@current_admin, new_status, notes)
    redirect_to admin_cheating_reports_path, notice: "Report #{new_status}."
  end
end
