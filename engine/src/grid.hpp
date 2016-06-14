#ifndef GRID_HPP
#define GRID_HPP

#include <string>
#include <vector>
#include "tile.hpp"

class Grid {
public:

    Grid();
    ~Grid();

    void printTiles();

    bool makeArmy(std::string playerID);
    bool makeUnit(std::string playerID, Unit::Type type, std::vector<int> xyz);
    const std::vector<std::vector<int>>& getPlayerPositions(){ return playerPositions; }

private:

    const int WIDTH = 50; // mach adjust
    const int MAX_PLAYERS = 10;

    int unitCount; // increasing unit ID
    std::unordered_map<int, std::shared_ptr<Unit>> unitIndex;
    std::vector<std::vector<Tile>> grid;
    std::vector<std::vector<int>> playerPositions; // prefilled player positions

    void makeTiles();
    void makePlayerPositions();

};

#endif // GRID_HPP
