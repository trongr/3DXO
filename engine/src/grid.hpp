#ifndef GRID_HPP
#define GRID_HPP

#include <string>
#include <vector>
#include <unordered_map>
#include "tile.hpp"

class Grid {
public:

Grid();
~Grid();

private:

const int WIDTH = 10; // mach adjust
// mach make it an index of game objects instead of Tile
std::unordered_map<int, Tile> index;
std::vector<std::vector<Tile>> grid;

void genTiles();

};

#endif // GRID_HPP
