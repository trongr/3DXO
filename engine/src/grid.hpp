#ifndef GRID_HPP
#define GRID_HPP

#include <string>
#include <vector>
#include "tile.hpp"

class Grid {
public:

Grid();
~Grid();
bool addUnit(std::string type, std::vector<int> xyz);

private:

const int WIDTH = 10; // mach adjust
std::vector<std::vector<Tile>> grid;

void genTiles();

};

#endif // GRID_HPP
