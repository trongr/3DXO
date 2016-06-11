#include <iostream>
#include "grid.hpp"

using namespace std;

Grid::Grid():
    unitCount(0),
    grid(WIDTH, vector<Tile>(WIDTH))
{
    makeTiles();
}

Grid::~Grid(){

}

void Grid::printTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile t = grid[i][j];
            if (t.isEmpty()){
                cerr << ".";
            } else {
                cerr << Unit::TypeStrings[t.getUnit()->getType()];
            }
        }
        cerr << "\n";
    }
}

// mach
void Grid::makeArmy(int playerID){
    makeUnit(playerID, Unit::PAWN, {0, 0, 0});
    makeUnit(playerID, Unit::PAWN, {0, 1, 0});
    makeUnit(playerID, Unit::PAWN, {0, 2, 0});
}

void Grid::makeTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile t = Tile({i, j, 0});
            grid[i][j] = t;
        }
    }
}

bool Grid::makeUnit(int playerID, Unit::Type type, vector<int> xyz){
    std::shared_ptr<Unit> u(new Unit(unitCount++, playerID, type, xyz));
    unitIndex.emplace(u->getID(), u);
    int x = xyz[0];
    int y = xyz[1];
    if (grid[x][y].isEmpty()){
        grid[x][y].setUnit(u);
        return true;
    } else {
        return false;
    }
}
