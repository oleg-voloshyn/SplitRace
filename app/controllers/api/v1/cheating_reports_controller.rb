module Api
  module V1
    class CheatingReportsController < BaseController
      def create
        tournament = begin
          Tournament.find_by!(slug: params[:tournament_slug])
        rescue
          Tournament.find(params[:tournament_id])
        end

        report = CheatingReport.new(
          reporter: current_user,
          reported_user_id: params[:reported_user_id],
          tournament:,
          reason: params[:reason]
        )

        if report.save
          render json: { id: report.id, status: report.status }, status: :created
        else
          render json: { errors: report.errors.full_messages }, status: :unprocessable_content
        end
      end
    end
  end
end
