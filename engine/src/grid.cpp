#include <vector>
#include <iostream>
#include "grid.hpp"

using namespace std;

Grid::Grid():
    grid(WIDTH, vector<Tile>(WIDTH))
{
    makeTiles();
}

Grid::~Grid(){

}

void Grid::printTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile t = Tile({i, j, 0});
            if (t.isEmpty()){
                cerr << ".";
            } else {
                cerr << t.getUnit()->getType();
            }
        }
        cerr << endl;
    }
}

// mach
void Grid::makeArmy(int playerID){
    makeUnit(playerID, "p", {0, 0, 0});
    makeUnit(playerID, "p", {0, 1, 0});
    makeUnit(playerID, "p", {0, 2, 0});
}

void Grid::makeTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile t = Tile({i, j, 0});
            grid[i][j] = t;
        }
    }
}

bool Grid::makeUnit(int playerID, string type, vector<int> xyz){
    std::shared_ptr<Unit> u(new Unit(playerID, type, xyz));
    Tile t = grid[xyz[0]][xyz[1]];
    if (t.isEmpty()){
        t.setUnit(u);
        return true;
    } else {
        return false;
    }
}
