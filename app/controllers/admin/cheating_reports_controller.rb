module Admin
  class CheatingReportsController < Admin::BaseController
    def index
      @reports = CheatingReport.for_admin
      @reports = @reports.where(status: params[:status]) if params[:status].present?
    end

    def show
      @report = CheatingReport.includes(:reporter, :reported_user, :tournament).find(params[:id])
    end

    def update
      @report = CheatingReport.find(params[:id])
      notes   = params[:admin_notes]

      case params[:status]
      when 'dismissed' then @report.dismiss!(@current_admin, notes)
      when 'upheld'    then @report.uphold!(@current_admin, notes)
      else
        redirect_to admin_cheating_report_path(@report), alert: 'Invalid action.'
        return
      end

      redirect_to admin_cheating_reports_path, notice: "Report #{@report.status}."
    rescue AASM::InvalidTransition
      redirect_to admin_cheating_report_path(@report), alert: 'Report has already been reviewed.'
    end
  end
end
