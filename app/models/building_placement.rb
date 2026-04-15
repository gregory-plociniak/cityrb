class BuildingPlacement < ApplicationRecord
  BOARD_SIZE = 10
  BUILDING_KEYS = %w[tile_2 road_col road_row].freeze

  validates :row, :col, :building_key, presence: true
  validates :row, inclusion: { in: 0...BOARD_SIZE }, uniqueness: { scope: :col }
  validates :col, inclusion: { in: 0...BOARD_SIZE }
  validates :building_key, inclusion: { in: BUILDING_KEYS }
end
