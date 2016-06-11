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

    void makeArmy(int playerID);
    bool makeUnit(int playerID, Unit::Type type, std::vector<int> xyz);

private:

    int unitCount; // increasing unit ID
    std::unordered_map<int, std::shared_ptr<Unit>> unitIndex;

    const int WIDTH = 10; // mach adjust
    std::vector<std::vector<Tile>> grid;

    void makeTiles();

};

#endif // GRID_HPP
