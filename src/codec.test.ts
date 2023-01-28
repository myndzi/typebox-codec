import { Type } from '@sinclair/typebox';
import { Codec } from './codec';
import { Transformer } from './transformer';
import { Apply, Transform } from './util';

describe('Codec', () => {
  describe('#Transform (value)', () => {
    it(`runs the selected transformer when requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Apply(
        Type.String(),
        Transform(C_Test, T_Test, () => 'ok'),
      );
      expect(C_Test.Transform(T_Test, schema, 'fail')).toEqual('ok');
    });

    it(`doesn't run a transformer when not requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test, T_Other);
      const schema = Apply(
        Type.String(),
        Transform(C_Test, T_Test, () => 'ok'),
      );
      expect(C_Test.Transform(T_Other, schema, 'ok')).toEqual('ok');
    });

    it(`supports codec inheritance`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);
      const schema = Apply(
        Type.String(),
        Transform(C_Broad, T_Test, () => 'ok'),
      );
      expect(C_Narrow.Transform(T_Test, schema, 'fail')).toEqual('ok');
    });

    it(`overrides parent transforms with child transforms`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);

      let schema = Apply(
        Type.String(),
        Transform(C_Broad, T_Test, () => 'broad'),
        Transform(C_Narrow, T_Test, () => 'narrow'),
      );
      expect(C_Narrow.Transform(T_Test, schema, 'fail')).toEqual('narrow');
      expect(C_Broad.Transform(T_Test, schema, 'fail')).toEqual('broad');

      schema = Apply(
        Type.String(),
        Transform(C_Narrow, T_Test, () => 'narrow'),
        Transform(C_Broad, T_Test, () => 'broad'),
      );
      expect(C_Narrow.Transform(T_Test, schema, 'fail')).toEqual('narrow');
      expect(C_Broad.Transform(T_Test, schema, 'fail')).toEqual('broad');
    });

    it(`fails when called with an unregistered Transformer`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Apply(
        Type.String(),
        Transform(C_Test, T_Test, () => 'ok'),
      );
      expect(() => C_Test.Transform(T_Other, schema, 'fail')).toThrow(/Cannot find the transformer/);
    });
  });

  describe('#Transform (object)', () => {
    it(`runs the selected transformer when requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      });
      expect(C_Test.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'ok',
      });
    });

    it(`doesn't run a transformer when not requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test, T_Other);
      const schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      });
      expect(C_Test.Transform(T_Other, schema, { string: 'ok' })).toEqual({
        string: 'ok',
      });
    });

    it(`supports codec inheritance`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);
      const schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Broad, T_Test, () => 'ok'),
        ),
      });
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'ok',
      });
    });

    it(`overrides parent transforms with child transforms`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);

      let schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Broad, T_Test, () => 'broad'),
          Transform(C_Narrow, T_Test, () => 'narrow'),
        ),
      });
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'narrow',
      });
      expect(C_Broad.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'broad',
      });

      schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Narrow, T_Test, () => 'narrow'),
          Transform(C_Broad, T_Test, () => 'broad'),
        ),
      });
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'narrow',
      });
      expect(C_Broad.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'broad',
      });
    });

    it(`fails when called with an unregistered Transformer`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      });
      expect(() => C_Test.Transform(T_Other, schema, { string: 'fail' })).toThrow(/Cannot find the transformer/);
    });

    it(`fails when the structure of the data doesn't match the expected structure from the schema`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Object({
        string: Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      });
      expect(() => C_Test.Transform(T_Test, schema, 'fail')).toThrow(/not an object/);
    });
  });

  describe('#Transform (array)', () => {
    it(`runs the selected transformer when requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      );
      expect(C_Test.Transform(T_Test, schema, ['fail'])).toEqual(['ok']);
    });

    it(`doesn't run a transformer when not requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test, T_Other);
      const schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      );
      expect(C_Test.Transform(T_Other, schema, ['ok'])).toEqual(['ok']);
    });

    it(`supports codec inheritance`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);
      const schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Broad, T_Test, () => 'ok'),
        ),
      );
      expect(C_Narrow.Transform(T_Test, schema, ['fail'])).toEqual(['ok']);
    });

    it(`overrides parent transforms with child transforms`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);

      let schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Broad, T_Test, () => 'broad'),
          Transform(C_Narrow, T_Test, () => 'narrow'),
        ),
      );
      expect(C_Narrow.Transform(T_Test, schema, ['fail'])).toEqual(['narrow']);
      expect(C_Broad.Transform(T_Test, schema, ['fail'])).toEqual(['broad']);

      schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Narrow, T_Test, () => 'narrow'),
          Transform(C_Broad, T_Test, () => 'broad'),
        ),
      );
      expect(C_Narrow.Transform(T_Test, schema, ['fail'])).toEqual(['narrow']);
      expect(C_Broad.Transform(T_Test, schema, ['fail'])).toEqual(['broad']);
    });

    it(`fails when called with an unregistered Transformer`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      );
      expect(() => C_Test.Transform(T_Other, schema, ['fail'])).toThrow(/Cannot find the transformer/);
    });

    it(`fails when the structure of the data doesn't match the expected structure from the schema`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const schema = Type.Array(
        Apply(
          Type.String(),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      );
      expect(() => C_Test.Transform(T_Test, schema, 'fail')).toThrow(/not an array/);
    });
  });

  xdescribe('#Transform (ref)', () => {
    it(`runs the selected transformer when requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      };

      const schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(C_Test.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'ok',
      });
    });

    it(`doesn't run a transformer when not requested`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test, T_Other);
      const $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      };

      const schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(C_Test.Transform(T_Other, schema, { string: 'ok' })).toEqual({
        string: 'ok',
      });
    });

    it(`supports codec inheritance`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);
      const $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Broad, T_Test, () => 'ok'),
        ),
      };

      const schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'ok',
      });
    });

    it(`overrides parent transforms with child transforms`, () => {
      const T_Test = new Transformer('TestTransformer');
      const C_Broad = new Codec('BroadCodec', T_Test);
      const C_Narrow = new Codec('NarrowCodec', C_Broad);

      let $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Broad, T_Test, () => 'broad'),
          Transform(C_Narrow, T_Test, () => 'narrow'),
        ),
      };

      let schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'narrow',
      });
      expect(C_Broad.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'broad',
      });

      $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Narrow, T_Test, () => 'narrow'),
          Transform(C_Broad, T_Test, () => 'broad'),
        ),
      };

      schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(C_Narrow.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'narrow',
      });
      expect(C_Broad.Transform(T_Test, schema, { string: 'fail' })).toEqual({
        string: 'broad',
      });
    });

    it(`fails when called with an unregistered Transformer`, () => {
      const T_Test = new Transformer('TestTransformer');
      const T_Other = new Transformer('OtherTransformer');
      const C_Test = new Codec('TestCodec', T_Test);
      const $defs = {
        strRef: Apply(
          Type.String({ $id: '#/$defs/strRef' }),
          Transform(C_Test, T_Test, () => 'ok'),
        ),
      };

      const schema = Type.Object(
        {
          string: Type.Ref($defs.strRef),
        },
        { $defs },
      );
      expect(() => C_Test.Transform(T_Other, schema, { string: 'fail' })).toThrow(/Cannot find the transformer/);
    });
  });
});
