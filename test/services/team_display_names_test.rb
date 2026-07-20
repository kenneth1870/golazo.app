require "test_helper"

class TeamDisplayNamesTest < ActiveSupport::TestCase
  test "display_name maps municipal liberia to escorpiones" do
    assert_equal "Escorpiones", TeamDisplayNames.display_name("Municipal Liberia")
  end

  test "flag_url uses escorpiones crest override" do
    url = TeamDisplayNames.flag_url("Municipal Liberia", "https://example.com/old.png")
    assert_equal TeamDisplayNames::ESCORPIONES_LOGO, url
  end

  test "slug_for parameterizes display name" do
    assert_equal "escorpiones", TeamDisplayNames.slug_for("Municipal Liberia")
    assert_equal "perez-zeledon", TeamDisplayNames.slug_for("Pérez Zeledón")
  end

  test "matches_slug compares normalized names" do
    assert TeamDisplayNames.matches_slug?("Escorpiones", "escorpiones")
    assert_not TeamDisplayNames.matches_slug?("Saprissa", "escorpiones")
  end
end
