#include <vector>
#include <iostream>
#include "grid.hpp"

using namespace std;

Grid::Grid():
    grid(WIDTH, vector<Tile>(WIDTH))
{
    genTiles();
}

Grid::~Grid(){

}

void Grid::genTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile t = Tile({i, j, 0});
            grid[i][j] = t;
        }
    }
}

bool Grid::addUnit(string type, vector<int> xyz){
    std::shared_ptr<Unit> u(new Unit(type, xyz));
    Tile t = grid[xyz[0]][xyz[1]];
    if (t.isEmpty()){
        // index[u->getID()] = u;
        t.setUnit(u);
        return true;
    } else {
        return false;
    }
}
