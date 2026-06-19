const Stubs = {}

Stubs.cpp =
    `#include <iostream>
using namespace std;

int main(){
    cout << "Hello World\\n";
    return 0;
}`;

Stubs.py = `print("Hello World")`;     
export default Stubs;