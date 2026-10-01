---
description: "Implements a fragment shader using GLSL."
---

# GskGLShader

Implements a fragment shader using GLSL.

A fragment shader gets the coordinates being rendered as input and
produces the pixel values for that particular pixel. Additionally,
the shader can declare a set of other input arguments, called
uniforms (as they are uniform over all the calls to your shader in
each instance of use). A shader can also receive up to 4
textures that it can use as input when producing the pixel data.

`GskGLShader` is usually used with `gtk_snapshot_push_gl_shader()`
to produce a `Gsk.GLShaderNode` in the rendering hierarchy,
and then its input textures are constructed by rendering the child
nodes to textures before rendering the shader node itself. (You can
pass texture nodes as children if you want to directly use a texture
as input).

The actual shader code is GLSL code that gets combined with
some other code into the fragment shader. Since the exact
capabilities of the GPU driver differs between different OpenGL
drivers and hardware, GTK adds some defines that you can use
to ensure your GLSL code runs on as many drivers as it can.

If the OpenGL driver is GLES, then the shader language version
is set to 100, and GSK_GLES will be defined in the shader.

Otherwise, if the OpenGL driver does not support the 3.2 core profile,
then the shader will run with language version 110 for GL2 and 130 for GL3,
and GSK_LEGACY will be defined in the shader.

If the OpenGL driver supports the 3.2 code profile, it will be used,
the shader language version is set to 150, and GSK_GL3 will be defined
in the shader.

The main function the shader must implement is:

```glsl
 void mainImage(out vec4 fragColor,
                in vec2 fragCoord,
                in vec2 resolution,
                in vec2 uv)
```

Where the input `fragCoord` is the coordinate of the pixel we're
currently rendering, relative to the boundary rectangle that was
specified in the `GskGLShaderNode`, and `resolution` is the width and
height of that rectangle. This is in the typical GTK coordinate
system with the origin in the top left. `uv` contains the u and v
coordinates that can be used to index a texture at the
corresponding point. These coordinates are in the [0..1]x[0..1]
region, with 0, 0 being in the lower left corder (which is typical
for OpenGL).

The output `fragColor` should be a RGBA color (with
premultiplied alpha) that will be used as the output for the
specified pixel location. Note that this output will be
automatically clipped to the clip region of the glshader node.

In addition to the function arguments the shader can define
up to 4 uniforms for textures which must be called u_textureN
(i.e. u_texture1 to u_texture4) as well as any custom uniforms
you want of types int, uint, bool, float, vec2, vec3 or vec4.

All textures sources contain premultiplied alpha colors, but if some
there are outer sources of colors there is a `gsk_premultiply()` helper
to compute premultiplication when needed.

Note that GTK parses the uniform declarations, so each uniform has to
be on a line by itself with no other code, like so:

```glsl
uniform float u_time;
uniform vec3 u_color;
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;
```

GTK uses the "gsk" namespace in the symbols it uses in the
shader, so your code should not use any symbols with the prefix gsk
or GSK. There are some helper functions declared that you can use:

```glsl
vec4 GskTexture(sampler2D sampler, vec2 texCoords);
```

This samples a texture (e.g. u_texture1) at the specified
coordinates, and contains some helper ifdefs to ensure that
it works on all OpenGL versions.

You can compile the shader yourself using `Gsk.GLShader.compile()`,
otherwise the GSK renderer will do it when it handling the glshader
node. If errors occurs, the returned `error` will include the glsl
sources, so you can see what GSK was passing to the compiler. You
can also set GSK_DEBUG=shaders in the environment to see the sources
and other relevant information about all shaders that GSK is handling.

## An example shader

```glsl
uniform float position;
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;

void mainImage(out vec4 fragColor,
               in vec2 fragCoord,
               in vec2 resolution,
               in vec2 uv) {
  vec4 source1 = GskTexture(u_texture1, uv);
  vec4 source2 = GskTexture(u_texture2, uv);

  fragColor = position * source1 + (1.0 - position) * source2;
}
```

> **Deprecated since 4.16.** This feature was deprecated in GTK 4.16 after the new rendering infrastructure introduced in 4.14 did not support it. The lack of Vulkan integration would have made it a very hard feature to support. If you want to use OpenGL directly, you should look at [GtkGLArea](../gtk4/class.GLArea.html), which uses a different approach and is still well-supported.

```tsx
import { GskGLShader } from "@gtkx/jsx/gsk";
```

## Hierarchy

[GObject](.gtkx/reference/gobject/object.md) → **GskGLShader**

## Props

`ref` receives the `Gsk.GLShader` instance. Every mutable property also has an `onNotify<Prop>` handler prop called with the new value when the property changes. Props inherited from ancestor elements are documented on their own pages.

### `resource`

`string` · default `null` · construct-only

Resource containing the source code for the shader.

If the shader source is not coming from a resource, this
will be `null`.

### `source`

`GLib.Bytes` · construct-only

The source code for the shader, as a `GBytes`.

## Methods

Methods are called on the `Gsk.GLShader` instance, obtained with the `ref` prop or imported from `@gtkx/gi/gsk`. Methods inherited from ancestors are documented on their own pages.

### `compile`

```ts
compile(renderer: Gsk.Renderer): boolean
```

Tries to compile the `shader` for the given `renderer`.

If there is a problem, this function returns `false` and reports
an error. You should use this function before relying on the shader
for rendering and use a fallback with a simpler shader or without
shaders if it fails.

Note that this will modify the rendering state (for example
change the current GL context) and requires the renderer to be
set up. This means that the widget has to be realized. Commonly you
want to call this from the realize signal of a widget, or during
widget snapshot.

**Parameters**

- `renderer`: a `GskRenderer`

**Returns** `true` on success, `false` if an error occurred

**Throws** A `GLib.Error` carrying the failing operation's domain, code, and message.

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `findUniformByName`

```ts
findUniformByName(name: string): number
```

Looks for a uniform by the name `name`, and returns the index
of the uniform, or -1 if it was not found.

**Parameters**

- `name`: uniform name

**Returns** The index of the uniform, or -1

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgBool`

```ts
getArgBool(args: GLib.Bytes, idx: number): boolean
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of bool type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform

**Returns** The value

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgFloat`

```ts
getArgFloat(args: GLib.Bytes, idx: number): number
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of float type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform

**Returns** The value

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgInt`

```ts
getArgInt(args: GLib.Bytes, idx: number): number
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of int type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform

**Returns** The value

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgsSize`

```ts
getArgsSize(): number
```

Get the size of the data block used to specify arguments for this shader.

**Returns** The size of the data block

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgUint`

```ts
getArgUint(args: GLib.Bytes, idx: number): number
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of uint type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform

**Returns** The value

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgVec2`

```ts
getArgVec2(args: GLib.Bytes, idx: number, outValue: Graphene.Vec2): void
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of vec2 type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform
- `outValue`: location to store the uniform value in

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgVec3`

```ts
getArgVec3(args: GLib.Bytes, idx: number, outValue: Graphene.Vec3): void
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of vec3 type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform
- `outValue`: location to store the uniform value in

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getArgVec4`

```ts
getArgVec4(args: GLib.Bytes, idx: number, outValue: Graphene.Vec4): void
```

Gets the value of the uniform `idx` in the `args` block.

The uniform must be of vec4 type.

**Parameters**

- `args`: uniform arguments
- `idx`: index of the uniform
- `outValue`: location to store set the uniform value in

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getNTextures`

```ts
getNTextures(): number
```

Returns the number of textures that the shader requires.

This can be used to check that the a passed shader works
in your usecase. It is determined by looking at the highest
u_textureN value that the shader defines.

**Returns** The number of texture inputs required by `shader`

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getNUniforms`

```ts
getNUniforms(): number
```

Get the number of declared uniforms for this shader.

**Returns** The number of declared uniforms

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getResource`

```ts
getResource(): string | null
```

Gets the resource path for the GLSL sourcecode being used
to render this shader.

**Returns** The resource path for the shader

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getSource`

```ts
getSource(): GLib.Bytes
```

Gets the GLSL sourcecode being used to render this shader.

**Returns** The source code for the shader

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getUniformName`

```ts
getUniformName(idx: number): string
```

Get the name of the declared uniform for this shader at index `idx`.

**Parameters**

- `idx`: index of the uniform

**Returns** The name of the declared uniform

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getUniformOffset`

```ts
getUniformOffset(idx: number): number
```

Get the offset into the data block where data for this uniforms is stored.

**Parameters**

- `idx`: index of the uniform

**Returns** The data offset

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.

### `getUniformType`

```ts
getUniformType(idx: number): Gsk.GLUniformType
```

Get the type of the declared uniform for this shader at index `idx`.

**Parameters**

- `idx`: index of the uniform

**Returns** The type of the declared uniform

> **Deprecated since 4.16.** GTK's new Vulkan-focused rendering does not support this feature. Use [GtkGLArea](../gtk4/class.GLArea.html) for OpenGL rendering.
