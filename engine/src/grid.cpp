#include <vector>
#include <iostream>
#include "grid.hpp"

using namespace std;

Grid::Grid()
    : grid(WIDTH, vector<Tile>(WIDTH)){
    genTiles();
}

Grid::~Grid(){

}

void Grid::genTiles(){
    cerr << "generating tiles mach\n";
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            grid[i][j] = Tile({i, j, 0});
        }
    }
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            cerr << grid[i][j].getXYZ()[0];
        }
        cerr << endl;
    }
}
