require "test_helper"

class TeamDisplayNamesTest < ActiveSupport::TestCase
  test "display_name shortens Costa Rican club names" do
    assert_equal "Saprissa", TeamDisplayNames.display_name("Deportivo Saprissa")
  end

  test "slug_for parameterizes display names" do
    assert_equal "saprissa", TeamDisplayNames.slug_for("Deportivo Saprissa")
  end
end
