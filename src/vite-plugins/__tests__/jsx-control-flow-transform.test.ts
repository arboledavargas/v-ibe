import { describe, it, expect } from 'vitest';
import { jsxControlFlowPlugin } from '../jsx-control-flow-transform';

describe('jsxControlFlowPlugin', () => {
  const plugin = jsxControlFlowPlugin();
  
  // Helper function to apply transformation
  const transform = (code: string, filename: string = 'test.tsx') => {
    if (!plugin.transform || typeof plugin.transform !== 'function') {
      throw new Error('Plugin transform is not a function');
    }
    
    const result = plugin.transform.call(
      { parse: () => {}, resolve: () => {} }, // mock context
      code,
      filename
    );
    
    return result;
  };

  describe('Plugin Configuration', () => {
    it('debe tener el nombre correcto', () => {
      expect(plugin.name).toBe('jsx-control-flow-transform');
    });

    it('debe tener enforce="pre"', () => {
      expect(plugin.enforce).toBe('pre');
    });
  });

  describe('File Filtering', () => {
    it('debe retornar null para archivos que no son TSX/JSX', () => {
      const result = transform('<For each={arr}>{item => item}</For>', 'test.ts');
      expect(result).toBeNull();
    });

    it('debe retornar null para archivos .js', () => {
      const result = transform('<For each={arr}>{item => item}</For>', 'test.js');
      expect(result).toBeNull();
    });

    it('debe procesar archivos .tsx', () => {
      const code = '<For each={arr}>{item => item}</For>';
      const result = transform(code, 'test.tsx');
      expect(result).not.toBeNull();
    });

    it('debe procesar archivos .jsx', () => {
      const code = '<For each={arr}>{item => item}</For>';
      const result = transform(code, 'test.jsx');
      expect(result).not.toBeNull();
    });

    it('debe retornar null si no hay componentes de control flow', () => {
      const code = '<div>Hello World</div>';
      const result = transform(code, 'test.tsx');
      expect(result).toBeNull();
    });
  });

  describe('For Component Transformation', () => {
    it('debe transformar <For> básico con arrow function', () => {
      const input = `
        <For each={items}>
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items');
      expect(result!.code).toContain('children: (item) => <div>{item}</div>');
    });

    it('debe transformar <For> con this.property', () => {
      const input = `
        <For each={this.items}>
          {(item, index) => <div key={item.id}>{item.name}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: this.items');
      expect(result!.code).toContain('children:');
    });

    it('debe transformar <For> con fallback', () => {
      const input = `
        <For each={items} fallback={<p>Empty</p>}>
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items');
      expect(result!.code).toContain('fallback: <p>Empty</p>');
      expect(result!.code).toContain('children:');
    });

    it('debe transformar <For> con array literal vacío', () => {
      const input = `
        <For each={[]}>
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: []');
    });

    it('debe transformar <For> con expresión compleja', () => {
      const input = `
        <For each={items.filter(x => x.active)}>
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items.filter(x => x.active)');
    });
  });

  describe('ForEach Component Transformation', () => {
    it('debe transformar <ForEach> básico', () => {
      const input = `
        <ForEach each={list}>
          {(item) => <span>{item}</span>}
        </ForEach>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('ForEach({');
      expect(result!.code).toContain('each: list');
    });
  });

  describe('IndexFor Component Transformation', () => {
    it('debe transformar <IndexFor> básico', () => {
      const input = `
        <IndexFor each={items}>
          {(item, index) => <div>{index}: {item}</div>}
        </IndexFor>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('IndexFor({');
      expect(result!.code).toContain('each: items');
    });
  });

  describe('Show Component Transformation', () => {
    it('debe transformar <Show> básico con when', () => {
      const input = `
        <Show when={isVisible}>
          <Content />
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: isVisible');
      expect(result!.code).toContain('children: <Content />');
    });

    it('debe transformar <Show> con this.property', () => {
      const input = `
        <Show when={this.isVisible}>
          <Content />
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: this.isVisible');
    });

    it('debe transformar <Show> con fallback', () => {
      const input = `
        <Show when={isLoaded} fallback={<Loading />}>
          <Content />
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: isLoaded');
      expect(result!.code).toContain('fallback: <Loading />');
      expect(result!.code).toContain('children: <Content />');
    });

    it('debe transformar <Show> con expresión booleana compleja', () => {
      const input = `
        <Show when={user && user.isAdmin}>
          <AdminPanel />
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: user && user.isAdmin');
    });

    it('debe transformar <Show> self-closing con fallback', () => {
      const input = `
        <Show when={false} fallback={<Loading />} />
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: false');
      expect(result!.code).toContain('fallback: <Loading />');
    });
  });

  describe('Switch Component Transformation', () => {
    it('debe transformar <Switch> básico', () => {
      const input = `
        <Switch>
          <Case1 />
        </Switch>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Switch({');
      expect(result!.code).toContain('children: <Case1 />');
    });

    it('debe transformar <Switch> self-closing', () => {
      const input = `
        <Switch fallback={<Default />} />
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Switch({');
      expect(result!.code).toContain('fallback: <Default />');
    });
  });

  describe('Nested JSX Transformation', () => {
    it('debe transformar <For> con nested JSX', () => {
      const input = `
        <For each={items}>
          {(item) => (
            <div>
              <h1>{item.title}</h1>
              <p>{item.description}</p>
            </div>
          )}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items');
      expect(result!.code).toContain('<h1>');
      expect(result!.code).toContain('<p>');
    });

    it('debe transformar <Show> con nested <For>', () => {
      const input = `
        <Show when={hasItems}>
          <For each={items}>
            {(item) => <div>{item}</div>}
          </For>
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('when: hasItems');
      expect(result!.code).toContain('For({');
    });

    it('debe transformar múltiples componentes en el mismo archivo', () => {
      const input = `
        const Component = () => (
          <div>
            <Show when={showList}>
              <For each={items}>
                {(item) => <div>{item}</div>}
              </For>
            </Show>
          </div>
        );
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('For({');
    });
  });

  describe('Props con diferentes tipos', () => {
    it('debe manejar props booleanas sin valor', () => {
      const input = `
        <Show when={condition} keepAlive>
          <Content />
        </Show>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('keepAlive: true');
    });

    it('debe manejar props con string literals', () => {
      const input = `
        <For each={items} key="id">
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('key: "id"');
    });

    it('debe manejar múltiples props', () => {
      const input = `
        <For each={items} fallback={<Empty />} key="id">
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items');
      expect(result!.code).toContain('fallback: <Empty />');
      expect(result!.code).toContain('key: "id"');
    });
  });

  describe('Edge Cases', () => {
    it('debe manejar <For> sin children', () => {
      const input = `<For each={items} />`;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('each: items');
    });

    it('debe manejar whitespace en children', () => {
      const input = `
        <For each={items}>
          
          {(item) => <div>{item}</div>}
          
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
    });

    it('debe mantener comentarios en el código', () => {
      const input = `
        // This is a comment
        <For each={items}>
          {(item) => <div>{item}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('// This is a comment');
    });

    it('no debe transformar componentes normales con nombres similares', () => {
      const input = `
        <FormatText value="test" />
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).toBeNull(); // No hay componentes de control flow
    });

    it('debe manejar JSX dentro de expresiones complejas', () => {
      const input = `
        const result = condition ? (
          <For each={items}>
            {(item) => <div>{item}</div>}
          </For>
        ) : null;
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('For({');
    });
  });

  describe('Real World Examples', () => {
    it('debe transformar ejemplo complejo de lista de usuarios', () => {
      const input = `
        const UserList = () => (
          <div class="user-list">
            <Show when={this.isLoading} fallback={
              <For each={this.users} fallback={<p>No users found</p>}>
                {(user, index) => (
                  <div key={user.id} class="user-card">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <Show when={user.isAdmin}>
                      <span class="badge">Admin</span>
                    </Show>
                  </div>
                )}
              </For>
            }>
              <div class="spinner">Loading...</div>
            </Show>
          </div>
        );
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('For({');
      expect(result!.code).toContain('when: this.isLoading');
      expect(result!.code).toContain('each: this.users');
    });

    it('debe transformar componente con Switch anidado', () => {
      const input = `
        <Switch>
          <For each={cases}>
            {(item) => <Case value={item} />}
          </For>
        </Switch>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('Switch({');
      expect(result!.code).toContain('For({');
    });

    it('debe preservar el código JSX normal mezclado con control flow', () => {
      const input = `
        const App = () => (
          <div class="app">
            <header>
              <h1>My App</h1>
            </header>
            <main>
              <Show when={isLoggedIn}>
                <For each={items}>
                  {(item) => <div>{item}</div>}
                </For>
              </Show>
            </main>
            <footer>
              <p>Footer content</p>
            </footer>
          </div>
        );
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('<header>');
      expect(result!.code).toContain('<footer>');
      expect(result!.code).toContain('Show({');
      expect(result!.code).toContain('For({');
    });
  });

  describe('Type Safety', () => {
    it('debe mantener tipos TypeScript en el código transformado', () => {
      const input = `
        interface User {
          id: number;
          name: string;
        }
        
        <For each={users as User[]}>
          {(user: User) => <div>{user.name}</div>}
        </For>
      `;
      
      const result = transform(input, 'test.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('interface User');
      expect(result!.code).toContain('For({');
    });
  });

  describe('Performance', () => {
    it('debe ser eficiente con archivos grandes sin control flow', () => {
      const largeCode = Array(1000)
        .fill('<div>Normal JSX</div>')
        .join('\n');
      
      const start = performance.now();
      const result = transform(largeCode, 'test.tsx');
      const end = performance.now();
      
      expect(result).toBeNull(); // No hay control flow
      expect(end - start).toBeLessThan(100); // Debe ser rápido
    });
  });
});
