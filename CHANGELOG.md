## V 2.0.1

### Backpressure is supported.
Added buffer to handle streams backpressure.

### Visual formatter is moved into its repository.
To install it, run
```bash
npm i @tsxper/log-stream-formatter-visual -D
```

### Improved handling double slashes.
Added extra slashes to send valid JSON into stdout.
This behavior can be changed.
```JavaScript
Logger.setDoubleSlashes(false);
```

### Default error stream now is stdout. 
This change makes it easier to use visual logs formatter.

## V 1.0.0
First version with general functionality.
