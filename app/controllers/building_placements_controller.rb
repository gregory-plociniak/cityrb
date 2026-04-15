class BuildingPlacementsController < ApplicationController
  def index
    render json: BuildingPlacement.order(:row, :col).map { |placement| serialize_placement(placement) }
  end

  def destroy_all
    BuildingPlacement.destroy_all
    head :no_content
  end

  def create
    placement = BuildingPlacement.find_or_initialize_by(
      row: building_placement_params[:row],
      col: building_placement_params[:col]
    )
    placement.building_key = building_placement_params[:building_key]

    if placement.save
      render json: serialize_placement(placement), status: :created
    else
      render json: { errors: placement.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def building_placement_params
    params.require(:building_placement).permit(:row, :col, :building_key)
  end

  def serialize_placement(placement)
    placement.slice(:id, :row, :col, :building_key)
  end

end
